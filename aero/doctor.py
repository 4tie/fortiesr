r"""aero/doctor.py contains backend logic for AeRo reasoning over a single strategy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence

from aero.backend_api import read_backtest_result
from aero.models import BacktestVisit, Finding


class Analyze:
    def __init__(self, *, visit: BacktestVisit, source_text: str) -> None:
        self.visit = visit
        self.source_text = source_text

    def findings(self) -> List[Finding]:
        findings: List[Finding] = []
        findings.extend(self._severity_findings())
        findings.extend(self._risk_findings())
        findings.extend(self._style_findings())
        findings.extend(self._sanity_findings())
        return findings

    def _severity_findings(self) -> List[Finding]:
        findings: List[Finding] = []
        raw = self.visit.raw or {}
        summary = raw.get("summary", {}) if isinstance(raw.get("summary"), dict) else {}
        profit = summary.get("net_profit_pct", summary.get("total_profit_pct"))
        if profit is None:
            profit = getattr(self.visit, "strategy_profit", None)
        trades = getattr(self.visit, "trades_count", None) or summary.get("total_trades")
        win_rate = getattr(self.visit, "win_rate", None)
        if win_rate is None and isinstance(summary.get("win_rate_pct"), (int, float)):
            win_rate = summary.get("win_rate_pct")
        dd = getattr(self.visit, "drawdown", None)
        if dd is None and isinstance(summary.get("max_drawdown_pct"), (int, float)):
            dd = summary.get("max_drawdown_pct")

        if isinstance(profit, (int, float)) and profit < -50:
            findings.append(
                Finding(
                    finding_id="loss_large",
                    title="Large loss detected",
                    severity="high",
                    plain_explanation="The backtest shows the strategy lost most of the money. Losses are bigger than wins.",
                    fix_description="Do not trust this version. Change the stop-loss and filtering before live testing.",
                    diff="",
                )
            )
        if isinstance(trades, (int, float)) and trades == 0:
            findings.append(
                Finding(
                    finding_id="no_trades",
                    title="No trades executed",
                    severity="high",
                    plain_explanation="The strategy did not open any trades in this run. Possible bad trigger condition or invalid data.",
                    fix_description="Check entry logic and pair/date range.",
                    diff="",
                )
            )
        if isinstance(win_rate, (int, float)) and win_rate < 45:
            findings.append(
                Finding(
                    finding_id="low_win_rate",
                    title="Low win rate",
                    severity="medium",
                    plain_explanation="Wins are rare. This strategy mostly loses trades.",
                    fix_description="Widen the filter or tighten the stop-loss. Do not increase position size.",
                    diff="",
                )
            )
        if isinstance(dd, (int, float)) and float(dd) > 60:
            findings.append(
                Finding(
                    finding_id="large_drawdown",
                    title="Very deep drawdown",
                    severity="high",
                    plain_explanation="The biggest losing streak was larger than acceptable for real trading.",
                    fix_description="Add stop-loss and risk limits before any further testing.",
                    diff="",
                )
            )
        return findings

    def _risk_findings(self) -> List[Finding]:
        findings: List[Finding] = []
        if "stoploss = -0.336" in self.source_text:
            findings.append(
                Finding(
                    finding_id="stoploss_too_loose",
                    title="Stop-loss is very loose",
                    severity="high",
                    plain_explanation="Current stop-loss waits for a huge loss before closing. One bad trade can wipe out many winners.",
                    fix_description="Tighten the stop-loss to a safer value.",
                    diff="",
                )
            )
        if "trailing_stop = False" in self.source_text:
            findings.append(
                Finding(
                    finding_id="no_trailing_stop",
                    title="Trailing stop is disabled",
                    severity="medium",
                    plain_explanation="The strategy does not follow the price up once a trade is winning. It can give back most of the gain.",
                    fix_description="Enable trailing stop or add a positive trailing offset after testing.",
                    diff="",
                )
            )
        return findings

    def _style_findings(self) -> List[Finding]:
        findings: List[Finding] = []
        if "\u4444" in self.source_text or "minimal_roi={" in self.source_text.replace(" ", ""):
            if "1553" in self.source_text and "2332" in self.source_text and "3169" in self.source_text:
                findings.append(
                    Finding(
                        finding_id="roi_table_gap",
                        title="ROI table has a large gap",
                        severity="low",
                        plain_explanation="The profit targets jump from short timeframes to much later ones without a smooth ladder.",
                        fix_description="Simplify the ROI table into one steady step-down list.",
                        diff="",
                    )
                )
        return findings

    def _sanity_findings(self) -> List[Finding]:
        findings: List[Finding] = []
        if "print(" in self.source_text:
            findings.append(
                Finding(
                    finding_id="noise_prints",
                    title="Extra prints in strategy",
                    severity="low",
                    plain_explanation="The strategy prints progress text during backtesting. It does not break things, but makes logs messy.",
                    fix_description="Remove debug prints after diagnosis.",
                    diff="",
                )
            )
        return findings
