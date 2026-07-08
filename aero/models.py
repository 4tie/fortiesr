r"""aero/models.py contains backend logic for results and suggestions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class BacktestVisit:
    run_id: str = ""
    strategy_profit: float | None = None
    trades_count: int = 0
    win_rate: float | None = None
    drawdown: float | None = None
    profit_factor: float | None = None
    expectancy: float | None = None
    final_balance: float | None = None
    starting_balance: float | None = None
    raw: dict[str, Any] | None = None
    artifacts: dict[str, str] | None = None


@dataclass(slots=True)
class Finding:
    finding_id: str = ""
    title: str = ""
    severity: str = "low"
    plain_explanation: str = ""
    fix_description: str = ""
    diff: str = ""
    applied: bool = False
