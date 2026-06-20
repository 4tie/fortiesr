"""Router: POST /api/backtest/run

Triggers a synchronous Freqtrade backtest wrapped inside a background task
so the HTTP response is returned immediately.  Callers poll
GET /api/session/status/{session_id} for the run_id once completed.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ...core.errors import BackendError
from ...models import RunRequest, RunStatus
from ...services.backtest.backtest_service import extract_freqtrade_error, preflight_strategy
from ..dependencies import get_services, get_session_store
from ..models import AsyncJobResponse, BacktestApiRequest
from ..session_store import SessionStore

router = APIRouter(prefix="/api/backtest", tags=["Backtest"])


@router.post(
    "/run",
    response_model=AsyncJobResponse,
    status_code=202,
    summary="Run a strategy backtest",
    description=(
        "Queues a Freqtrade backtesting job for the specified strategy and parameters. "
        "Returns a session_id immediately; poll /api/session/status/{session_id} for the "
        "run_id once the backtest completes."
    ),
)
async def run_backtest(
    body: BacktestApiRequest,
    background_tasks: BackgroundTasks,
    services=Depends(get_services),
    store: SessionStore = Depends(get_session_store),
) -> AsyncJobResponse:
    if services.backtest_runner.is_busy():
        raise HTTPException(
            status_code=409,
            detail="Backtest runner is busy. Wait for the current run to finish.",
        )

    try:
        strategy = services.registry.get_strategy(body.strategy_name)
    except BackendError as exc:
        raise HTTPException(status_code=404, detail=exc.message)

    pointer = services.version_manager.get_current_pointer(body.strategy_name)
    if pointer is None and body.version_id is None:
        try:
            version_meta = await asyncio.to_thread(
                services.version_manager.ensure_registered, strategy
            )
            pointer = services.version_manager.get_current_pointer(body.strategy_name)
        except Exception as exc:
            raise HTTPException(
                status_code=409,
                detail=f"Could not auto-register strategy '{body.strategy_name}': {exc}",
            )

    version_id: str = body.version_id or (pointer.accepted_version_id if pointer else "")

    # Pre-flight: verify strategy files exist and are syntactically valid
    settings = services.settings_store.load()
    preflight_errors = await asyncio.to_thread(
        preflight_strategy,
        settings.strategies_directory_path,
        body.strategy_name,
    )
    if preflight_errors:
        raise HTTPException(
            status_code=422,
            detail={
                "status": "error",
                "reason": "PREFLIGHT_FAILED",
                "errors": preflight_errors,
                "message": (
                    "Strategy pre-flight validation failed. Fix the reported issues "
                    "before running a backtest."
                ),
            },
        )

    record = store.create("backtest")
    background_tasks.add_task(
        _run_backtest_task,
        services,
        store,
        record.session_id,
        strategy,
        version_id,
        body,
    )
    return AsyncJobResponse(
        session_id=record.session_id,
        status="queued",
        message=(
            f"Backtest queued for strategy '{body.strategy_name}' (version {version_id}). "
            f"Poll /api/session/status/{record.session_id} for the run_id once completed."
        ),
    )


async def _run_backtest_task(
    services,
    store: SessionStore,
    session_id: str,
    strategy,
    version_id: str,
    body: BacktestApiRequest,
) -> None:
    store.update(session_id, status="running", started_at=datetime.now(tz=UTC))
    try:
        settings = services.settings_store.load()
        config_file = body.config_file or settings.default_config_file_path

        run_request = RunRequest(
            strategy_name=body.strategy_name,
            version_id=version_id,
            config_file=config_file,
            timerange=body.timerange,
            timeframe=body.timeframe,
            pairs=body.pairs,
            max_open_trades=body.max_open_trades,
            dry_run_wallet=body.dry_run_wallet,
        )

        def _phase_callback(phase: str, result_data: dict | None = None) -> None:
            if result_data:
                existing = store.get(session_id)
                merged = {**(existing.result or {}), **result_data}
                store.update(session_id, status=phase, result=merged)
            else:
                store.update(session_id, status=phase)

        run_id: str = await asyncio.to_thread(
            services.backtest_runner.run_backtest, strategy, version_id, run_request, _phase_callback
        )

        metadata = services.run_repository.load_metadata(run_id)
        run_result = {
            "run_id": run_id,
            "strategy_name": body.strategy_name,
            "version_id": version_id,
            "timerange": body.timerange,
            **(store.get(session_id).result or {}),
        }

        if metadata.run_status == RunStatus.FAILED:
            exit_code = metadata.freqtrade_exit_code
            code_hint = f" (exit code {exit_code})" if exit_code is not None else ""
            run_dir = services.run_repository.find_run_dir(run_id)
            ft_error = extract_freqtrade_error(run_dir)
            if ft_error:
                error_msg = f"Backtest failed{code_hint}: {ft_error}"
            else:
                error_msg = (
                    f"Backtest failed{code_hint}. "
                    "Check the run logs for details — common causes are missing "
                    "candle data for the requested timerange, a strategy error, "
                    "or an invalid configuration."
                )
            store.update(
                session_id,
                status="failed",
                completed_at=datetime.now(tz=UTC),
                error=error_msg,
                result=run_result,
            )
        elif metadata.run_status == RunStatus.CANCELLED:
            store.update(
                session_id,
                status="failed",
                completed_at=datetime.now(tz=UTC),
                error="Backtest was cancelled.",
                result=run_result,
            )
        else:
            store.update(
                session_id,
                status="completed",
                completed_at=datetime.now(tz=UTC),
                result=run_result,
            )
    except BackendError as exc:
        store.update(
            session_id,
            status="failed",
            completed_at=datetime.now(tz=UTC),
            error=exc.message,
        )
    except Exception as exc:
        store.update(
            session_id,
            status="failed",
            completed_at=datetime.now(tz=UTC),
            error=str(exc),
        )
