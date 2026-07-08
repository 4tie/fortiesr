r"""aero/backend_api.py contains backend logic for reading backtest results."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from aero.models import BacktestVisit


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKTEST_ROOT = PROJECT_ROOT / "user_data" / "backtest_results"
AERO_ROOT = Path(__file__).resolve().parent
AERO_IMPROVED_CACHE = AERO_ROOT / "improved"


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _list_result_dirs() -> list[str]:
    if not BACKTEST_ROOT.exists():
        return []
    out = []
    for child in BACKTEST_ROOT.iterdir():
        if not child.is_dir():
            continue
        for run_dir in child.iterdir():
            if run_dir.is_dir() and (run_dir / "parsed_summary.json").exists():
                out.append(run_dir.name)
    out.sort(reverse=True)
    return out


def _result_dir_for(run_id: str) -> Path | None:
    if not run_id:
        return None
    for candidate in BACKTEST_ROOT.rglob(run_id):
        if candidate.is_dir() and (candidate / "parsed_summary.json").exists():
            return candidate
    return None


def list_backtest_runs(run_id: str | None = None) -> list[dict[str, Any]]:
    dirs = _list_result_dirs()
    if run_id:
        dirs = [d for d in dirs if d == run_id] or dirs[:1]
    runs = []
    for dir_name in dirs[:20]:
        run_dir = _result_dir_for(dir_name)
        if run_dir is None:
            continue
        metadata = _read_json(run_dir / "metadata.json")
        runs.append(
            {
                "run_id": dir_name,
                "strategy_name": metadata.get("strategy_name"),
                "created_at": metadata.get("created_at"),
                "status": metadata.get("run_status"),
            }
        )
    return runs


def read_backtest_result(run_id: str) -> BacktestVisit:
    if not run_id:
        raise ValueError("run_id is required")
    run_dir = _result_dir_for(run_id)
    if run_dir is None:
        raise FileNotFoundError(f"Backtest run not found: {run_id}")
    summary = _read_json(run_dir / "parsed_summary.json")
    advanced = _read_json(run_dir / "advanced_metrics.json")
    metadata = _read_json(run_dir / "metadata.json")
    return BacktestVisit(
        run_id=run_id,
        strategy_profit=summary.get("net_profit_pct"),
        trades_count=int(summary.get("total_trades", 0) or 0),
        win_rate=summary.get("win_rate_pct"),
        drawdown=summary.get("max_drawdown_pct"),
        profit_factor=advanced.get("profit_factor") or summary.get("profit_factor"),
        expectancy=advanced.get("expectancy") or summary.get("expectancy"),
        final_balance=summary.get("final_balance"),
        starting_balance=summary.get("starting_balance"),
        raw={
            "summary": summary,
            "metadata": metadata,
            "run_dir": str(run_dir),
        },
    )


def find_source_text(run_id: str) -> tuple[str, str]:
    run_dir = _result_dir_for(run_id)
    if run_dir is None:
        return "", ""
    for name in ["strategy_snapshot.py", "strategy.py"]:
        p = run_dir / name
        if p.exists():
            return str(p), p.read_text(encoding="utf-8", errors="ignore")
    for name in ["strategy_params.json", "params.json"]:
        p = run_dir / name
        if p.exists():
            return str(p), p.read_text(encoding="utf-8", errors="ignore")
    return "", ""
