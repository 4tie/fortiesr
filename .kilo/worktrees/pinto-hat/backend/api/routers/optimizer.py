"""Router: POST /api/optimizer/run

Starts a systematic parameter-search session.  The optimizer already manages
its own internal asyncio.Task, so this endpoint simply forwards the request,
gets an optimizer_session_id back immediately, and then monitors the session
in a lightweight background coroutine that updates the API session store.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ...core.errors import BackendError
from ...models import StartOptimizerRequest, SearchStrategy, OptimizerScoreMetric
from ..models import AsyncJobResponse, OptimizerApiRequest
from ..session_store import SessionStore

router = APIRouter(prefix="/api/optimizer", tags=["Optimizer"])


# ── Export / Apply request models ─────────────────────────────────────────────


class ApplyTrialRequest(BaseModel):
    strategy_name: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class ExportTrialItem(BaseModel):
    strategy_name: str
    trial_number: int
    score: float | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)


class ExportTrialsRequest(BaseModel):
    trials: list[ExportTrialItem]


_TERMINAL_PHASES = {"completed", "failed", "cancelled"}


@router.post(
    "/run",
    response_model=AsyncJobResponse,
    status_code=202,
    summary="Start a parameter optimizer session",
    description=(
        "Launches a systematic multi-trial parameter search for the given strategy. "
        "Returns a session_id immediately; poll /api/session/status/{session_id} for progress "
        "and the final best trial details."
    ),
)
async def run_optimizer(
    body: OptimizerApiRequest,
    request: Request,
) -> AsyncJobResponse:
    services = request.app.state.services
    store: SessionStore = request.app.state.session_store

    if services.strategy_optimizer.is_running():
        raise HTTPException(
            status_code=409,
            detail="An optimizer session is already running. Cancel it first or wait for it to finish.",
        )

    try:
        services.registry.get_strategy(body.strategy_name)
    except BackendError as exc:
        raise HTTPException(status_code=404, detail=exc.message)

    pointer = services.version_manager.get_current_pointer(body.strategy_name)
    if pointer is None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Strategy '{body.strategy_name}' has no accepted version. "
                "Accept a version before running the optimizer."
            ),
        )

    api_record = store.create("optimizer")

    try:
        settings = services.settings_store.load()
        config_file = body.config_file or settings.default_config_file_path

        from ...models import ParameterSearchSpace

        parsed_spaces = []
        for raw in body.search_spaces:
            try:
                parsed_spaces.append(ParameterSearchSpace.model_validate(raw))
            except Exception:
                pass

        internal_request = StartOptimizerRequest(
            strategy_name=body.strategy_name,
            timerange=body.timerange,
            timeframe=body.timeframe,
            pairs=body.pairs,
            config_file=config_file,
            total_trials=body.total_trials,
            search_strategy=SearchStrategy(body.search_strategy),
            score_metric=OptimizerScoreMetric(body.score_metric),
            max_open_trades=body.max_open_trades,
            dry_run_wallet=body.dry_run_wallet,
            fee_rate=body.fee_rate,
            search_spaces=parsed_spaces,
        )

        optimizer_session = await services.strategy_optimizer.start_session(internal_request)

    except BackendError as exc:
        store.update(
            api_record.session_id,
            status="failed",
            completed_at=datetime.now(tz=UTC),
            error=exc.message,
        )
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except ValueError as exc:
        store.update(
            api_record.session_id,
            status="failed",
            completed_at=datetime.now(tz=UTC),
            error=str(exc),
        )
        raise HTTPException(status_code=400, detail=str(exc))

    store.update(
        api_record.session_id,
        status="running",
        started_at=datetime.now(tz=UTC),
        result={"optimizer_session_id": optimizer_session.session_id},
    )

    asyncio.create_task(
        _monitor_optimizer(
            services, store, api_record.session_id, optimizer_session.session_id
        )
    )

    return AsyncJobResponse(
        session_id=api_record.session_id,
        status="running",
        message=(
            f"Optimizer started — {body.total_trials} trials for '{body.strategy_name}'. "
            f"Internal optimizer_session_id={optimizer_session.session_id}. "
            f"Poll /api/session/status/{api_record.session_id} for progress."
        ),
    )


@router.get(
    "/search-spaces/{strategy_name}",
    summary="Get default parameter search spaces for a strategy",
    description=(
        "Returns a list of ParameterSearchSpace objects inferred from the strategy's "
        "parameter definitions. Used by the frontend to populate the parameters table."
    ),
)
async def get_search_spaces(strategy_name: str, request: Request):
    services = request.app.state.services
    try:
        spaces = services.strategy_optimizer.build_search_spaces_from_strategy(strategy_name)
    except BackendError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    return {"strategy_name": strategy_name, "search_spaces": [s.model_dump() for s in spaces]}


@router.get(
    "/sessions",
    summary="List optimizer sessions",
    description="Returns all optimizer sessions sorted by newest first. Filter by strategy_name if provided.",
)
async def list_optimizer_sessions(
    strategy_name: str | None = None,
    request: Request = None,
) -> list[dict]:
    services = request.app.state.services
    summaries = services.optimizer_store.list_sessions(strategy_name)
    return [s.model_dump(mode="json") for s in summaries]


@router.get(
    "/session/{optimizer_session_id}",
    summary="Get full optimizer session data including all trials",
    description=(
        "Returns the complete OptimizerSession record from disk, including the "
        "full trials[] array with per-trial metrics. Poll this at 300 ms during "
        "a run to drive live charts and the trial table."
    ),
)
async def get_optimizer_session(
    optimizer_session_id: str,
    request: Request,
):
    services = request.app.state.services
    session = services.optimizer_store.load_session(optimizer_session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Optimizer session '{optimizer_session_id}' not found.",
        )
    return session


@router.post(
    "/apply-trial",
    summary="Apply a trial's parameters to the current accepted version",
    description=(
        "Writes the given parameter values into the accepted version's params.json so "
        "subsequent backtests pick them up.  Does not create a new version or touch git."
    ),
)
async def apply_trial(body: ApplyTrialRequest, request: Request) -> dict:
    services = request.app.state.services
    if services.backtest_runner.is_busy():
        raise HTTPException(
            status_code=409,
            detail="Cannot apply trial parameters while a backtest is running. Wait for it to complete first.",
        )
    try:
        services.registry.get_strategy(body.strategy_name)
    except BackendError as exc:
        raise HTTPException(status_code=404, detail=exc.message)

    pointer = services.version_manager.get_current_pointer(body.strategy_name)
    if pointer is None:
        raise HTTPException(
            status_code=409,
            detail=f"Strategy '{body.strategy_name}' has no accepted version.",
        )

    try:
        version_id = pointer.accepted_version_id
        parent_params = services.version_manager.load_params(body.strategy_name, version_id)
        merged = services.strategy_optimizer.trial_executor.build_trial_params(
            parent_params, body.parameters
        )
        params_path = (
            services.version_manager.version_dir(body.strategy_name, version_id) / "params.json"
        )
        from ...utils import atomic_write_json
        atomic_write_json(params_path, merged.model_dump(mode="json"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"ok": True, "message": f"Parameters applied to '{body.strategy_name}' accepted version."}


@router.post(
    "/export-trials",
    summary="Export one or more optimizer trials to the Stress Test Lab",
    description="Persists trial configurations to exported_optimizer_runs.json for use in temporal stress tests.",
)
async def export_trials(body: ExportTrialsRequest, request: Request) -> dict:
    services = request.app.state.services
    created = []
    for item in body.trials:
        record = services.exported_trial_store.append(
            strategy_name=item.strategy_name,
            trial_number=item.trial_number,
            score=item.score,
            parameters=item.parameters,
            metrics=item.metrics,
        )
        created.append(record)
    return {"ok": True, "exported": created, "count": len(created)}


@router.get(
    "/exported-trials",
    summary="List all exported optimizer trial configurations",
    description="Returns all records from exported_optimizer_runs.json, newest first.",
)
async def get_exported_trials(request: Request) -> dict:
    services = request.app.state.services
    records = services.exported_trial_store.list_all()
    return {"trials": records}


@router.post(
    "/cancel/{optimizer_session_id}",
    summary="Cancel a running optimizer session",
    description="Requests cancellation of the optimizer session and stops any active backtest.",
)
async def cancel_optimizer_session(optimizer_session_id: str, request: Request) -> dict:
    services = request.app.state.services
    try:
        session = await services.strategy_optimizer.cancel_session(optimizer_session_id)
        return {"ok": True, "phase": session.phase, "optimizer_session_id": optimizer_session_id}
    except BackendError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


def _flat_params_to_freqtrade_format(strategy_name: str, parameters: dict) -> dict:
    """Convert flat optimizer trial keys into Freqtrade-compatible nested format."""
    buy: dict = {}
    sell: dict = {}
    roi: dict = {}
    stoploss: float | None = None
    trailing: dict = {}

    for key, value in parameters.items():
        if key.startswith("buy__"):
            buy[key[5:]] = value
        elif key.startswith("sell__"):
            sell[key[6:]] = value
        elif key.startswith("roi__"):
            roi[key[5:]] = value
        elif key == "stoploss__value":
            stoploss = value
        elif key == "trailing__stop":
            trailing["trailing_stop"] = value
        elif key in ("trailing__positive", "trailing__positive_offset"):
            trailing["trailing_stop_positive"] = value
        elif key == "trailing__offset":
            trailing["trailing_stop_positive_offset"] = value
        elif key == "trailing__only_offset_is_reached":
            trailing["trailing_only_offset_is_reached"] = value

    params = {
        "buy": buy,
        "sell": sell,
        "roi": roi,
        "trailing": trailing,
    }
    if stoploss is not None:
        params["stoploss"] = stoploss

    return {
        "strategy_name": strategy_name,
        "params": params,
    }


def _get_trial_by_number(session, trial_number: int):
    trial = next((t for t in session.trials if t.trial_number == trial_number), None)
    if trial is None:
        raise HTTPException(
            status_code=404,
            detail=f"Trial #{trial_number} not found in session '{session.session_id}'.",
        )
    return trial


@router.get(
    "/session/{session_id}/best-trial/params",
    summary="Get best trial parameters in Freqtrade-compatible format",
)
async def get_best_trial_params(session_id: str, request: Request) -> dict:
    services = request.app.state.services
    session = services.optimizer_store.load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Optimizer session '{session_id}' not found.")
    if session.best_trial_number is None:
        raise HTTPException(status_code=404, detail="No best trial available yet.")
    trial = _get_trial_by_number(session, session.best_trial_number)
    return _flat_params_to_freqtrade_format(session.config.strategy_name, trial.parameters or {})


@router.get(
    "/session/{session_id}/trial/{trial_number}/params",
    summary="Get a specific trial's parameters in Freqtrade-compatible format",
)
async def get_trial_params(session_id: str, trial_number: int, request: Request) -> dict:
    services = request.app.state.services
    session = services.optimizer_store.load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Optimizer session '{session_id}' not found.")
    trial = _get_trial_by_number(session, trial_number)
    return _flat_params_to_freqtrade_format(session.config.strategy_name, trial.parameters or {})


@router.post(
    "/session/{session_id}/best-trial/promote-candidate",
    summary="Promote best optimizer trial to a candidate version (safe — does not touch accepted version)",
)
async def promote_best_trial_to_candidate(session_id: str, request: Request) -> dict:
    services = request.app.state.services
    session = services.optimizer_store.load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Optimizer session '{session_id}' not found.")
    if session.phase != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Session is not completed (current phase: '{session.phase}'). Wait for it to finish before promoting.",
        )
    if session.best_trial_number is None:
        raise HTTPException(status_code=404, detail="No best trial found in this session.")
    trial = _get_trial_by_number(session, session.best_trial_number)
    if trial.status != "completed":
        raise HTTPException(status_code=400, detail=f"Best trial #{trial.trial_number} is not completed.")
    if not trial.parameters:
        raise HTTPException(status_code=400, detail=f"Best trial #{trial.trial_number} has no parameters.")
    if not trial.run_id:
        raise HTTPException(
            status_code=400,
            detail=f"Best trial #{trial.trial_number} has no associated backtest run and cannot be promoted.",
        )
    try:
        result = services.version_manager.apply_optimizer_trial_to_new_version(
            run_repository=services.run_repository,
            optimizer_store=services.optimizer_store,
            session_id=session_id,
            trial_number=trial.trial_number,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "ok": True,
        "strategy_name": session.config.strategy_name,
        "candidate_version_id": result["version_id"],
        "trial_number": trial.trial_number,
        "score": trial.metrics.score if trial.metrics else None,
        "metrics": trial.metrics.model_dump(mode="json") if trial.metrics else {},
    }


@router.post(
    "/session/{session_id}/trial/{trial_number}/promote-candidate",
    summary="Promote a specific optimizer trial to a candidate version (safe — does not touch accepted version)",
)
async def promote_trial_to_candidate(session_id: str, trial_number: int, request: Request) -> dict:
    services = request.app.state.services
    session = services.optimizer_store.load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Optimizer session '{session_id}' not found.")
    trial = _get_trial_by_number(session, trial_number)
    if trial.status != "completed":
        raise HTTPException(status_code=400, detail=f"Trial #{trial_number} is not completed.")
    if not trial.parameters:
        raise HTTPException(status_code=400, detail=f"Trial #{trial_number} has no parameters.")
    if not trial.run_id:
        raise HTTPException(
            status_code=400,
            detail=f"Trial #{trial_number} has no associated backtest run and cannot be promoted.",
        )
    try:
        result = services.version_manager.apply_optimizer_trial_to_new_version(
            run_repository=services.run_repository,
            optimizer_store=services.optimizer_store,
            session_id=session_id,
            trial_number=trial_number,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "ok": True,
        "strategy_name": session.config.strategy_name,
        "candidate_version_id": result["version_id"],
        "trial_number": trial_number,
        "score": trial.metrics.score if trial.metrics else None,
        "metrics": trial.metrics.model_dump(mode="json") if trial.metrics else {},
    }


async def _monitor_optimizer(
    services,
    store: SessionStore,
    api_session_id: str,
    optimizer_session_id: str,
) -> None:
    """Poll the internal optimizer store until the session reaches a terminal phase."""
    while True:
        await asyncio.sleep(4.0)
        try:
            session = services.optimizer_store.load_session(optimizer_session_id)
        except Exception:
            session = None

        if session is None:
            store.update(
                api_session_id,
                status="failed",
                completed_at=datetime.now(tz=UTC),
                error="Optimizer session record could not be read from store.",
            )
            return

        if session.phase in _TERMINAL_PHASES:
            final_status = "completed" if session.phase == "completed" else "failed"
            best_score: float | None = (
                session.best_metrics.score if session.best_metrics else None
            )
            store.update(
                api_session_id,
                status=final_status,
                completed_at=datetime.now(tz=UTC),
                result={
                    "optimizer_session_id": optimizer_session_id,
                    "phase": session.phase,
                    "total_trials": session.total_trials,
                    "completed_trials": session.completed_trials,
                    "failed_trials": session.failed_trials,
                    "best_trial_number": session.best_trial_number,
                    "best_score": best_score,
                    "stop_reason": session.stop_reason,
                },
            )
            return
