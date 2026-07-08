r"""aero/fixer.py contains backend logic for strategy safe edits.

AeRo only ever edits copies inside `aero/uploads/`. The original strategy is
never modified by this module.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from aero.models import BacktestVisit, Finding


OLD_STOPLOSS = "stoploss = -0.336"
NEW_STOPLOSS = "stoploss = -0.10"

OLD_TRAILING = "trailing_stop = False"
NEW_TRAILING = "trailing_stop = True"

OLD_TRAILING_OFFSET = "trailing_stop_positive_offset = 0.0"
NEW_TRAILING_OFFSET = "trailing_stop_positive_offset = 0.015"


def _diff(old: str, new_text: str, old_value: Any, new_value: Any) -> str:
    return f"{old_value} -> {new_value}"


def apply_baseline(source: str, *, visit: BacktestVisit | None = None) -> tuple[str, list[Finding]]:
    findings: list[Finding] = []
    max_drawdown = getattr(visit, "drawdown", None) or 0.0
    win_rate = getattr(visit, "win_rate", None) or 100.0
    profit_factor = getattr(visit, "profit_factor", None) or 999.0
    trades = getattr(visit, "trades_count", None) or 0

    if trades > 0 and (max_drawdown > 60.0 or win_rate < 45.0):
        old = OLD_STOPLOSS
        new = NEW_STOPLOSS
        if old in source:
            source = source.replace(old, new, 1)
            findings.append(
                Finding(
                    finding_id="tighten_stoploss",
                    title="Tighten stop-loss",
                    severity="high",
                    plain_explanation="Current stop-loss waits for a huge loss before closing. One bad trade can wipe out many winners.",
                    fix_description=f"Changed stop-loss from {old.strip()} to {new.strip()}.",
                    diff=_diff(old, new, old.strip(), new.strip()),
                )
            )

    if OLD_TRAILING in source:
        source = source.replace(OLD_TRAILING, NEW_TRAILING, 1)
        findings.append(
            Finding(
                finding_id="enable_trailing_stop",
                title="Enable trailing stop",
                severity="medium",
                plain_explanation="Trailing stop keeps some winning profit when price turns against you.",
                fix_description=f"Changed trailing stop from {OLD_TRAILING.strip()} to {NEW_TRAILING.strip()}.",
                diff=_diff(OLD_TRAILING, NEW_TRAILING, OLD_TRAILING.strip(), NEW_TRAILING.strip()),
            )
        )

    if OLD_TRAILING_OFFSET in source:
        source = source.replace(OLD_TRAILING_OFFSET, NEW_TRAILING_OFFSET, 1)
        findings.append(
            Finding(
                finding_id="trailing_offset",
                title="Add trailing offset",
                severity="medium",
                plain_explanation="Trailing offset gives the strategy breathing room before triggering a trailing exit.",
                fix_description=f"Changed offset from {OLD_TRAILING_OFFSET.strip()} to {NEW_TRAILING_OFFSET.strip()}.",
                diff=_diff(OLD_TRAILING_OFFSET, NEW_TRAILING_OFFSET, OLD_TRAILING_OFFSET.strip(), NEW_TRAILING_OFFSET.strip()),
            )
        )

    return source, findings
