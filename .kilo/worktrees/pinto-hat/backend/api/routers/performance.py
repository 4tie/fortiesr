"""Router: /api/performance

Endpoints for the Performance Tab — Strategy History & Analytics Archive.

GET  /api/performance/runs               List all historical runs for a strategy.
GET  /api/performance/runs/{run_id}      Full detail for a single run.
POST /api/performance/runs/{run_id}/apply  Apply that run's parameters to the
                                           current accepted version via VersionManager.
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ...core.errors import BackendError
from ...utils import atomic_write_json

router = APIRouter(prefix="/api/performance", tags=["Performance"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _summary_row(metadata, parsed_summary) -> dict[str, Any]:
    """Flatten RunMetadata + ParsedSummary into a single serialisable dict."""
    row: dict[str, Any] = {
        "run_id":             metadata.run_id,
        "strategy_name":      metadata.strategy_name,
        "strategy_version_id": metadata.strategy_version_id,
        "timeframe":          metadata.timeframe,
        "pairs":              metadata.pairs,
        "timerange":          metadata.timerange,
        "run_status":         metadata.run_status.value if hasattr(metadata.run_status, "value") else str(metadata.run_status),
        "created_at":         metadata.created_at.isoformat(),
        "completed_at":       metadata.completed_at.isoformat() if metadata.completed_at else None,
        "net_profit_pct":     None,
        "max_drawdown_pct":   None,
        "total_trades":       None,
        "win_rate_pct":       None,
        "sharpe_ratio":       None,
        "profit_factor":      None,
    }
    if parsed_summary:
        row["net_profit_pct"]   = parsed_summary.net_profit_pct
        row["max_drawdown_pct"] = parsed_summary.max_drawdown_pct
        row["total_trades"]     = parsed_summary.total_trades
        row["win_rate_pct"]     = parsed_summary.win_rate_pct
        row["sharpe_ratio"]     = parsed_summary.sharpe_ratio
        row["profit_factor"]    = parsed_summary.profit_factor
    return row


# ── list runs ─────────────────────────────────────────────────────────────────

@router.get(
    "/runs",
    summary="List historical backtest runs for a strategy",
    description=(
        "Returns all completed backtest runs for the given strategy, newest first. "
        "Each row includes key performance metrics merged from metadata and parsed_summary."
    ),
)
async def list_performance_runs(
    request: Request,
    strategy: str = Query(..., description="Strategy name to filter by"),
) -> dict:
    services = request.app.state.services

    try:
        metadatas = await asyncio.to_thread(
            services.run_repository.list_runs, strategy
        )
    except BackendError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    rows: list[dict] = []
    for meta in metadatas:
        parsed_summary = None
        try:
            run_dir = services.run_repository.find_run_dir(meta.run_id)
            summary_path = run_dir / "parsed_summary.json"
            if summary_path.exists():
                from ...utils import read_json
                from ...models import ParsedSummary
                raw = read_json(summary_path)
                if raw:
                    parsed_summary = ParsedSummary.model_validate(raw)
        except Exception:
            pass
        rows.append(_summary_row(meta, parsed_summary))

    return {"strategy": strategy, "runs": rows, "total": len(rows)}


# ── run detail ────────────────────────────────────────────────────────────────

@router.get(
    "/runs/{run_id}",
    summary="Get full detail for a single historical backtest run",
    description=(
        "Returns the complete RunDetail for one run, including pair results, "
        "trades, advanced metrics, and the parameter block active at that run."
    ),
)
async def get_performance_run(run_id: str, request: Request) -> dict:
    services = request.app.state.services

    try:
        detail = await asyncio.to_thread(
            services.run_repository.load_detail, run_id
        )
    except BackendError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    params_snapshot: dict | None = None
    try:
        version_id = detail.metadata.strategy_version_id
        strategy_name = detail.metadata.strategy_name
        params = services.version_manager.load_params(strategy_name, version_id)
        params_snapshot = params.model_dump(mode="json")
    except Exception:
        pass

    return {
        "run_id":         detail.metadata.run_id,
        "metadata":       detail.metadata.model_dump(mode="json"),
        "parsed_summary": detail.parsed_summary.model_dump(mode="json") if detail.parsed_summary else None,
        "pair_results":   [p.model_dump(mode="json") for p in detail.pair_results],
        "advanced_metrics": detail.advanced_metrics.model_dump(mode="json") if detail.advanced_metrics else None,
        "trades_count":   len(detail.trades),
        "params_snapshot": params_snapshot,
        "freqtrade_command": detail.freqtrade_command,
    }


# ── apply parameters ──────────────────────────────────────────────────────────

@router.post(
    "/runs/{run_id}/apply",
    summary="Apply a historical run's parameters to the current accepted strategy version",
    description=(
        "Loads the parameter snapshot stored for the specified historical backtest run "
        "and writes it into the current accepted version's params.json via the "
        "VersionManager, exactly as the Optimizer's Apply Trial button does."
    ),
)
async def apply_run_parameters(run_id: str, request: Request) -> dict:
    services = request.app.state.services

    try:
        metadata = await asyncio.to_thread(
            services.run_repository.load_metadata, run_id
        )
    except BackendError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    strategy_name = metadata.strategy_name
    source_version_id = metadata.strategy_version_id
    run_created_at = metadata.created_at.strftime("%Y-%m-%d %H:%M UTC")

    pointer = services.version_manager.get_current_pointer(strategy_name)
    if pointer is None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Strategy '{strategy_name}' has no accepted version. "
                "Accept a version before applying historical parameters."
            ),
        )

    try:
        historical_params = services.version_manager.load_params(strategy_name, source_version_id)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Could not load parameters for version '{source_version_id}': {exc}",
        )

    try:
        current_version_id = pointer.accepted_version_id
        params_path = (
            services.version_manager.version_dir(strategy_name, current_version_id)
            / "params.json"
        )
        await asyncio.to_thread(
            atomic_write_json,
            params_path,
            historical_params.model_dump(mode="json"),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to write parameters: {exc}")

    return {
        "ok": True,
        "message": (
            f"Parameters from backtest {run_created_at} successfully applied "
            f"to active strategy via Version Manager."
        ),
        "strategy_name":        strategy_name,
        "source_version_id":    source_version_id,
        "target_version_id":    pointer.accepted_version_id,
        "run_id":               run_id,
    }
