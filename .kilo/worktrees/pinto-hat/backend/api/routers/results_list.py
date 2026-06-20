"""Router: GET /api/results

Lists all completed backtest runs with lightweight summary info,
suitable for a results table view.
"""

from __future__ import annotations

import json
import time as _time
from pathlib import Path

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ...models import ParsedSummary

router = APIRouter(prefix="/api", tags=["Results"])

# ── In-memory TTL cache to avoid O(n) directory scans on every layout switch ──
_CACHE_TTL_SECS = 30.0
_results_cache: dict = {"data": None, "ts": 0.0}


def invalidate_results_cache() -> None:
    """Call this after a new backtest completes to force a fresh scan."""
    _results_cache["data"] = None
    _results_cache["ts"] = 0.0


class ResultListItem(BaseModel):
    run_id: str
    strategy_name: str
    timerange: str
    timeframe: str
    created_at: str
    duration_ms: float | None = None
    parsed_summary: ParsedSummary | None = None


class ResultListResponse(BaseModel):
    results: list[ResultListItem]


def _read_json(path: Path, default=None):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


@router.get(
    "/results",
    response_model=ResultListResponse,
    summary="List all backtest results",
    description="Returns a lightweight list of completed backtest runs with parsed summaries.",
)
async def list_results(request: Request) -> ResultListResponse:
    now = _time.monotonic()
    if _results_cache["data"] is not None and (now - _results_cache["ts"]) < _CACHE_TTL_SECS:
        return _results_cache["data"]

    services = request.app.state.services
    repo = services.run_repository

    runs = repo.list_runs()
    items: list[ResultListItem] = []

    for metadata in runs:
        # Skip runs that haven't completed
        if metadata.run_status != "completed":
            continue

        run_dir = repo.find_run_dir(metadata.run_id)
        summary_raw = _read_json(run_dir / "parsed_summary.json")
        summary = ParsedSummary.model_validate(summary_raw) if summary_raw else None

        # Compute duration if we have completion time
        duration_ms = None
        if metadata.completed_at and metadata.created_at:
            try:
                from datetime import datetime
                if isinstance(metadata.completed_at, str):
                    completed = datetime.fromisoformat(metadata.completed_at)
                else:
                    completed = metadata.completed_at
                if isinstance(metadata.created_at, str):
                    created = datetime.fromisoformat(metadata.created_at)
                else:
                    created = metadata.created_at
                duration_ms = (completed - created).total_seconds() * 1000
            except Exception:
                pass

        items.append(ResultListItem(
            run_id=metadata.run_id,
            strategy_name=metadata.strategy_name,
            timerange=metadata.timerange,
            timeframe=metadata.timeframe,
            created_at=(
                metadata.created_at.isoformat()
                if hasattr(metadata.created_at, "isoformat")
                else str(metadata.created_at)
            ),
            duration_ms=duration_ms,
            parsed_summary=summary,
        ))

    result = ResultListResponse(results=items)
    _results_cache["data"] = result
    _results_cache["ts"] = now
    return result
