"""Router: POST /api/temporal-stress-lab/run

Temporal stress testing: runs the strategy across multiple sub-intervals
(Time Split / Walk-Forward, Monte Carlo, or Crash Gauntlet) to evaluate
robustness across different market conditions.
"""

from __future__ import annotations

import asyncio
import json
import random
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from ...core.errors import BackendError
from ...models import RunRequest
from ..models import AsyncJobResponse, TemporalStressLabApiRequest
from ..session_store import SessionStore

router = APIRouter(prefix="/api/temporal-stress-lab", tags=["Temporal Stress Lab"])

# ── Predefined crash periods ───────────────────────────────────────────────────

_CRASH_PERIODS = [
    {
        "label": "COVID Crash",
        "start": "20200215",
        "end": "20200331",
        "description": "Global market crash triggered by COVID-19 pandemic",
    },
    {
        "label": "China Mining Ban",
        "start": "20210510",
        "end": "20210731",
        "description": "China bans crypto mining — massive hash-rate exodus + sell-off",
    },
    {
        "label": "Crypto Winter Onset",
        "start": "20220101",
        "end": "20220401",
        "description": "Post-ATH bear market descent following November 2021 peak",
    },
    {
        "label": "Luna / UST Collapse",
        "start": "20220505",
        "end": "20220620",
        "description": "Terra Luna ecosystem collapse wiping ~$60B in days",
    },
    {
        "label": "Summer Liquidity Crisis",
        "start": "20220615",
        "end": "20220831",
        "description": "Celsius, 3AC, Voyager insolvencies cascade through market",
    },
    {
        "label": "FTX Collapse",
        "start": "20221101",
        "end": "20221231",
        "description": "FTX exchange collapse and industry-wide contagion",
    },
]


# ── Helpers ────────────────────────────────────────────────────────────────────


def _parse_date(s: str) -> date:
    return date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def _fmt(d: date) -> str:
    return d.strftime("%Y%m%d")


def _split_timerange(timerange: str) -> tuple[date, date]:
    parts = timerange.split("-")
    if len(parts) != 2 or len(parts[0]) != 8 or len(parts[1]) != 8:
        raise ValueError(
            f"timerange must be YYYYMMDD-YYYYMMDD, got: '{timerange}'"
        )
    return _parse_date(parts[0]), _parse_date(parts[1])


def _generate_time_split_segments(timerange: str, n_splits: int) -> list[dict]:
    start, end = _split_timerange(timerange)
    total_days = (end - start).days
    if total_days < n_splits * 2:
        raise ValueError(
            f"Timerange is only {total_days} days — too short for {n_splits} splits."
        )
    segment_days = total_days // n_splits
    segments: list[dict] = []
    for i in range(n_splits):
        seg_start = start + timedelta(days=i * segment_days)
        seg_end = end if i == n_splits - 1 else seg_start + timedelta(days=segment_days - 1)
        label = f"Segment {i + 1}"
        segments.append(
            {
                "label": label,
                "start": _fmt(seg_start),
                "end": _fmt(seg_end),
                "timerange": f"{_fmt(seg_start)}-{_fmt(seg_end)}",
                "description": "",
            }
        )
    return segments


def _generate_monte_carlo_segments(
    timerange: str, n_windows: int, window_days: int
) -> list[dict]:
    start, end = _split_timerange(timerange)
    total_days = (end - start).days
    if total_days < window_days + 1:
        raise ValueError(
            f"Timerange ({total_days} days) is shorter than window length ({window_days} days)."
        )
    max_offset = total_days - window_days
    rng = random.Random(42)
    seen: set[int] = set()
    segments: list[dict] = []
    for i in range(n_windows):
        for _ in range(100):
            offset = rng.randint(0, max_offset)
            if offset not in seen:
                seen.add(offset)
                break
        seg_start = start + timedelta(days=offset)
        seg_end = seg_start + timedelta(days=window_days - 1)
        segments.append(
            {
                "label": f"Random Window {i + 1}",
                "start": _fmt(seg_start),
                "end": _fmt(seg_end),
                "timerange": f"{_fmt(seg_start)}-{_fmt(seg_end)}",
                "description": f"{window_days}-day random sample",
            }
        )
    return segments


def _generate_crash_gauntlet_segments() -> list[dict]:
    return [
        {
            "label": cp["label"],
            "start": cp["start"],
            "end": cp["end"],
            "timerange": f"{cp['start']}-{cp['end']}",
            "description": cp["description"],
        }
        for cp in _CRASH_PERIODS
    ]


def _extract_segment_metrics(run_dir: Path, strategy_name: str) -> dict:
    raw_path = run_dir / "raw_result.json"
    if not raw_path.exists():
        return {}
    try:
        raw = json.loads(raw_path.read_text(encoding="utf-8"))
    except Exception:
        return {}

    block = (raw.get("strategy") or {}).get(strategy_name) or raw
    if not isinstance(block, dict):
        block = raw

    def _num(*keys: str) -> float | None:
        for k in keys:
            v = block.get(k)
            if v is not None:
                try:
                    return float(v)
                except Exception:
                    pass
        return None

    def _int_val(*keys: str) -> int | None:
        for k in keys:
            v = block.get(k)
            if v is not None:
                try:
                    return int(v)
                except Exception:
                    pass
        return None

    profit_raw = _num("profit_total", "profit_total_long", "profit_factor")
    net_profit_pct: float | None = None
    if profit_raw is not None:
        net_profit_pct = round(profit_raw * 100, 4) if abs(profit_raw) <= 20 else round(profit_raw, 4)

    total_trades = _int_val("total_trades", "trade_count")
    trades_list = block.get("trades") or raw.get("trades") or []
    win_rate_pct: float | None = None
    if trades_list and total_trades and total_trades > 0:
        wins = sum(
            1 for t in trades_list
            if isinstance(t, dict) and float(t.get("profit_ratio", 0) or 0) > 0
        )
        win_rate_pct = round(wins / total_trades * 100, 2)

    max_dd = _num("max_drawdown", "max_drawdown_low", "drawdown_abs")

    return {
        "net_profit_pct": net_profit_pct,
        "total_trades": total_trades,
        "win_rate_pct": win_rate_pct,
        "max_drawdown_pct": max_dd,
    }


def _consistency_score(results: list[dict]) -> float:
    finished = [r for r in results if r.get("status") in ("profitable", "loss")]
    if not finished:
        return 0.0
    profitable = sum(1 for r in finished if r["status"] == "profitable")
    return round(profitable / len(finished) * 100, 1)


# ── Endpoint ───────────────────────────────────────────────────────────────────


@router.post(
    "/run",
    response_model=AsyncJobResponse,
    status_code=202,
    summary="Run a temporal stress test",
    description=(
        "Launches a temporal robustness stress test using Time Split, Monte Carlo, "
        "or Crash Gauntlet mode. Each segment is run as a separate Freqtrade backtest. "
        "Returns a session_id immediately; poll /api/session/status/{session_id} for "
        "per-segment progress and aggregate metrics once complete."
    ),
)
async def run_temporal_stress_lab(
    body: TemporalStressLabApiRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> AsyncJobResponse:
    services = request.app.state.services
    store: SessionStore = request.app.state.session_store

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
    if pointer is None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Strategy '{body.strategy_name}' has no accepted version. "
                "Accept a version before running the stress lab."
            ),
        )
    version_id = pointer.accepted_version_id

    try:
        if body.mode == "time_split":
            segments = _generate_time_split_segments(body.timerange, body.n_splits or 4)
        elif body.mode == "monte_carlo":
            segments = _generate_monte_carlo_segments(
                body.timerange, body.n_windows or 5, body.window_days or 14
            )
        elif body.mode == "crash_gauntlet":
            segments = _generate_crash_gauntlet_segments()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown stress mode: {body.mode}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    record = store.create("temporal_stress_lab")
    store.update(
        record.session_id,
        status="running",
        started_at=datetime.now(tz=UTC),
        result={
            "mode": body.mode,
            "total_segments": len(segments),
            "completed_segments": 0,
            "current_segment": segments[0]["label"] if segments else None,
            "segments": [],
            "consistency_score": None,
            "exported_trial_id": body.exported_trial_id or None,
            "exported_trial_label": None,
        },
    )

    background_tasks.add_task(
        _run_stress_segments,
        services,
        store,
        record.session_id,
        strategy,
        version_id,
        body,
        segments,
    )

    return AsyncJobResponse(
        session_id=record.session_id,
        status="running",
        message=(
            f"Temporal stress lab started — {len(segments)} segments for "
            f"'{body.strategy_name}' ({body.mode} mode). "
            f"Poll /api/session/status/{record.session_id} for progress."
        ),
    )


# ── Background task ────────────────────────────────────────────────────────────


async def _run_stress_segments(
    services,
    store: SessionStore,
    session_id: str,
    strategy,
    version_id: str,
    body: TemporalStressLabApiRequest,
    segments: list[dict],
) -> None:
    settings = services.settings_store.load()
    config_file = body.config_file or settings.default_config_file_path

    # ── resolve exported trial parameters if requested ─────────────────────
    exported_trial_record: dict | None = None
    if body.exported_trial_id:
        exported_trial_record = services.exported_trial_store.find_by_id(body.exported_trial_id)
        if exported_trial_record is None:
            store.update(
                session_id,
                status="failed",
                completed_at=datetime.now(tz=UTC),
                error=f"Exported trial '{body.exported_trial_id}' not found. It may have been deleted.",
                result={
                    "mode": body.mode,
                    "total_segments": len(segments),
                    "completed_segments": 0,
                    "current_segment": None,
                    "segments": [],
                    "consistency_score": None,
                },
            )
            return

    exported_trial_label: str | None = (
        exported_trial_record.get("label") if exported_trial_record is not None else None
    )

    completed_results: list[dict] = []

    for i, seg in enumerate(segments):
        store.update(
            session_id,
            result={
                "mode": body.mode,
                "total_segments": len(segments),
                "completed_segments": i,
                "current_segment": seg["label"],
                "segments": completed_results,
                "consistency_score": None,
                "exported_trial_id": body.exported_trial_id or None,
                "exported_trial_label": exported_trial_label,
            },
        )

        seg_result: dict = {
            "label": seg["label"],
            "timerange": seg["timerange"],
            "start": seg["start"],
            "end": seg["end"],
            "description": seg.get("description", ""),
            "status": "running",
            "run_id": None,
            "net_profit_pct": None,
            "total_trades": None,
            "win_rate_pct": None,
            "max_drawdown_pct": None,
            "error": None,
        }

        trial_version_id: str | None = None
        try:
            effective_version_id = version_id

            # If an exported trial is selected, inject its parameters via a temporary version
            if exported_trial_record is not None:
                trial_parameters = exported_trial_record.get("parameters", {})
                if not trial_parameters:
                    raise ValueError(
                        f"Exported trial '{body.exported_trial_id}' has no parameter overrides."
                    )
                parent_params = services.version_manager.load_params(
                    body.strategy_name, version_id
                )
                trial_params = services.strategy_optimizer.trial_executor.build_trial_params(
                    parent_params, trial_parameters
                )
                parent_source = services.version_manager.load_strategy_source(
                    body.strategy_name, version_id
                )
                trial_version = services.strategy_optimizer.trial_executor.create_trial_version(
                    body.strategy_name,
                    version_id,
                    parent_source,
                    trial_params,
                    exported_trial_record.get("trial_number", 0),
                )
                trial_version_id = trial_version.version_id
                effective_version_id = trial_version_id

            run_req = RunRequest(
                strategy_name=body.strategy_name,
                version_id=effective_version_id,
                config_file=config_file,
                timerange=seg["timerange"],
                timeframe=body.timeframe or "1h",
                pairs=body.pairs or [],
                max_open_trades=body.max_open_trades,
                dry_run_wallet=body.dry_run_wallet,
            )

            run_id: str = await asyncio.to_thread(
                services.backtest_runner.run_backtest,
                strategy,
                effective_version_id,
                run_req,
                None,
            )
            seg_result["run_id"] = run_id

            run_dir = services.backtest_runner.run_repository.find_run_dir(run_id)
            metrics = _extract_segment_metrics(run_dir, body.strategy_name)
            seg_result.update(metrics)

            net = metrics.get("net_profit_pct")
            if net is not None:
                seg_result["status"] = "profitable" if net >= 0 else "loss"
            else:
                seg_result["status"] = "completed"

        except BackendError as exc:
            seg_result["status"] = "failed"
            seg_result["error"] = exc.message
        except Exception as exc:
            seg_result["status"] = "failed"
            seg_result["error"] = str(exc)
        finally:
            # Clean up the temporary trial version
            if trial_version_id:
                try:
                    services.version_manager.reject_version(trial_version_id, "Stress test segment completed")
                except Exception:
                    pass

        completed_results.append(seg_result)

    profits = [r["net_profit_pct"] for r in completed_results if r.get("net_profit_pct") is not None]
    drawdowns = [r["max_drawdown_pct"] for r in completed_results if r.get("max_drawdown_pct") is not None]
    consistency = _consistency_score(completed_results)

    profitable_segs = [r for r in completed_results if r.get("net_profit_pct") is not None]
    best = max(profitable_segs, key=lambda r: r["net_profit_pct"], default=None)
    worst = min(profitable_segs, key=lambda r: r["net_profit_pct"], default=None)

    dd_variance = round(max(drawdowns) - min(drawdowns), 4) if len(drawdowns) >= 2 else None

    store.update(
        session_id,
        status="completed",
        completed_at=datetime.now(tz=UTC),
        result={
            "mode": body.mode,
            "total_segments": len(segments),
            "completed_segments": len(completed_results),
            "current_segment": None,
            "segments": completed_results,
            "consistency_score": consistency,
            "avg_net_profit_pct": round(sum(profits) / len(profits), 4) if profits else None,
            "best_net_profit_pct": best["net_profit_pct"] if best else None,
            "best_segment_label": best["label"] if best else None,
            "worst_net_profit_pct": worst["net_profit_pct"] if worst else None,
            "worst_segment_label": worst["label"] if worst else None,
            "max_drawdown_variance": dd_variance,
            "exported_trial_id": body.exported_trial_id or None,
            "exported_trial_label": exported_trial_label,
        },
    )

