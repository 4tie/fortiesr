"""Router: GET /api/backtest/results/{run_id}

Returns a rich results payload for a completed backtest run, including
smart heuristic flags computed from the parsed summary.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import math

from ...models import (
    BacktestAdvancedMetrics,
    BacktestTrade,
    ExitReasonStat,
    HealthCheck,
    HealthReport,
    PairResult,
    ParsedSummary,
    SmartFlag,
)

router = APIRouter(prefix="/api/backtest", tags=["Backtest"])


class BacktestResultsResponse(BaseModel):
    run_id: str
    parsed_summary: ParsedSummary
    pair_results: list[PairResult]
    trades: list[BacktestTrade]
    advanced_metrics: BacktestAdvancedMetrics | None
    smart_flags: list[SmartFlag]
    health_report: HealthReport | None = None


def _read_json(path: Path, default=None):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _compute_smart_flags(summary: ParsedSummary, trades: list[BacktestTrade]) -> list[SmartFlag]:
    flags: list[SmartFlag] = []

    total_trades = summary.total_trades or 0
    trades_per_day = summary.trades_per_day

    if trades_per_day is not None and trades_per_day < 0.5 and total_trades > 0:
        flags.append(SmartFlag(
            type="warning",
            code="LOW_FREQUENCY",
            message="Trades per day is low. Strategy might be too restrictive.",
        ))

    max_drawdown = summary.max_drawdown_pct
    if max_drawdown is not None and abs(max_drawdown) > 15:
        flags.append(SmartFlag(
            type="danger",
            code="HIGH_DRAWDOWN",
            message="High drawdown detected! Watch your risk management.",
        ))

    if total_trades > 0 and summary.exit_reason_distribution:
        sl_count = sum(
            stat.count
            for stat in summary.exit_reason_distribution
            if "stop_loss" in stat.reason.lower() or stat.reason.lower() == "stoploss"
        )
        if sl_count / total_trades > 0.5:
            flags.append(SmartFlag(
                type="warning",
                code="STOPLOSS_HEAVY",
                message="Most trades are hitting hard stoplosses.",
            ))

    net_pct = summary.net_profit_pct
    if net_pct is not None and net_pct < 0:
        flags.append(SmartFlag(
            type="danger",
            code="NET_LOSS",
            message=f"Strategy produced a net loss of {net_pct:.2f}% over the backtest window.",
        ))

    win_rate = summary.win_rate_pct
    if win_rate is not None and win_rate < 40 and total_trades >= 10:
        flags.append(SmartFlag(
            type="warning",
            code="LOW_WIN_RATE",
            message=f"Win rate is {win_rate:.1f}%. Consider reviewing entry signals.",
        ))

    return flags


def _compute_health_report(summary: ParsedSummary, trades: list[BacktestTrade]) -> HealthReport:
    checks: list[HealthCheck] = []

    profit_values = [t.profit_abs for t in trades if t.profit_abs is not None]
    winning = [v for v in profit_values if v > 0]
    losing  = [v for v in profit_values if v <= 0]

    # ── 1. Winner-Take-All Trap ──────────────────────────────────────────────
    gross_profit = sum(winning) if winning else 0.0
    worst_loss   = min(losing, default=0.0)
    if gross_profit > 0 and losing:
        ratio = abs(worst_loss) / gross_profit
        if ratio >= 0.50:
            checks.append(HealthCheck(
                severity="red",
                code="WINNER_TAKE_ALL",
                title="Winner-Take-All Trap",
                message=(
                    f"Your single worst loss ({abs(worst_loss):.2f}) wipes out "
                    f"{ratio * 100:.0f}% of all gross profits — one bad trade dominates the results."
                ),
                suggestion=(
                    "Tighten your Stop-Loss percentage or add a Trailing Stop-Loss so no "
                    "single trade can cause catastrophic damage. Also review position sizing."
                ),
            ))
        elif ratio >= 0.25:
            checks.append(HealthCheck(
                severity="yellow",
                code="WINNER_TAKE_ALL",
                title="Winner-Take-All Trap",
                message=(
                    f"Your single worst loss ({abs(worst_loss):.2f}) erases "
                    f"{ratio * 100:.0f}% of all gross profits."
                ),
                suggestion=(
                    "Consider tightening the Stop-Loss percentage or implementing a "
                    "Trailing Stop-Loss to limit exposure on single trades."
                ),
            ))
        else:
            checks.append(HealthCheck(
                severity="green",
                code="WINNER_TAKE_ALL",
                title="Winner-Take-All Trap",
                message="No single loss dominates the profit picture. Good risk distribution.",
            ))
    else:
        checks.append(HealthCheck(
            severity="green",
            code="WINNER_TAKE_ALL",
            title="Winner-Take-All Trap",
            message="Insufficient trade data to evaluate. Run more backtests.",
        ))

    # ── 2. Consistency Ratio ─────────────────────────────────────────────────
    win_rate_frac = (summary.win_rate_pct / 100.0) if summary.win_rate_pct is not None else None
    avg_win  = (sum(winning) / len(winning))  if winning  else None
    avg_loss = (sum(abs(v) for v in losing) / len(losing)) if losing else None

    if win_rate_frac is not None and avg_win is not None and avg_loss is not None and avg_loss > 0:
        consistency = win_rate_frac * avg_win / avg_loss
        if consistency < 0.40:
            checks.append(HealthCheck(
                severity="red",
                code="CONSISTENCY_RATIO",
                title="Consistency Ratio",
                message=(
                    f"Ratio is {consistency:.2f} (win_rate × avg_win ÷ avg_loss). "
                    "Wins are not compensating for losses — the strategy is inconsistent."
                ),
                suggestion=(
                    "Optimize your Take-Profit targets so winning trades capture more gains, "
                    "or add a Trend Filter to avoid entering in unfavorable market conditions."
                ),
            ))
        elif consistency < 0.70:
            checks.append(HealthCheck(
                severity="yellow",
                code="CONSISTENCY_RATIO",
                title="Consistency Ratio",
                message=(
                    f"Ratio is {consistency:.2f}. Wins barely outpace losses on average."
                ),
                suggestion=(
                    "Consider tweaking your Take-Profit mechanism or adding a volatility "
                    "filter to avoid choppy market entries."
                ),
            ))
        else:
            checks.append(HealthCheck(
                severity="green",
                code="CONSISTENCY_RATIO",
                title="Consistency Ratio",
                message=f"Ratio is {consistency:.2f}. Wins adequately compensate for losses.",
            ))
    else:
        checks.append(HealthCheck(
            severity="green",
            code="CONSISTENCY_RATIO",
            title="Consistency Ratio",
            message="Not enough data to calculate the consistency ratio.",
        ))

    # ── 3. Drawdown Warning ──────────────────────────────────────────────────
    max_dd  = abs(summary.max_drawdown_pct) if summary.max_drawdown_pct is not None else None
    net_pct = summary.net_profit_pct

    if max_dd is not None and net_pct is not None:
        if net_pct <= 0:
            checks.append(HealthCheck(
                severity="red",
                code="DRAWDOWN_WARNING",
                title="Drawdown Warning",
                message=(
                    f"Max drawdown is {max_dd:.1f}% but net profit is "
                    f"{net_pct:.1f}% — the strategy is underwater with significant drawdown."
                ),
                suggestion=(
                    "The strategy is losing money while taking on significant drawdown risk. "
                    "Revisit your entry/exit logic and add protective stop-loss rules."
                ),
            ))
        elif max_dd > abs(net_pct) * 2.0:
            checks.append(HealthCheck(
                severity="red",
                code="DRAWDOWN_WARNING",
                title="Drawdown Warning",
                message=(
                    f"Max drawdown ({max_dd:.1f}%) is more than 2× net profit ({net_pct:.1f}%). "
                    "Risk far exceeds reward during this period."
                ),
                suggestion=(
                    "Add tighter position-sizing rules or a maximum drawdown circuit breaker. "
                    "Consider splitting capital across more pairs to dilute peak drawdown."
                ),
            ))
        elif max_dd > abs(net_pct):
            checks.append(HealthCheck(
                severity="yellow",
                code="DRAWDOWN_WARNING",
                title="Drawdown Warning",
                message=(
                    f"Max drawdown ({max_dd:.1f}%) exceeds net profit ({net_pct:.1f}%). "
                    "A bad stretch could erase all gains."
                ),
                suggestion=(
                    "Improve your stop-loss placement or add a trailing stop to protect "
                    "profits during adverse market conditions."
                ),
            ))
        else:
            checks.append(HealthCheck(
                severity="green",
                code="DRAWDOWN_WARNING",
                title="Drawdown Warning",
                message=(
                    f"Max drawdown ({max_dd:.1f}%) is within the profit range ({net_pct:.1f}%). "
                    "Acceptable risk-to-reward balance."
                ),
            ))
    else:
        checks.append(HealthCheck(
            severity="green",
            code="DRAWDOWN_WARNING",
            title="Drawdown Warning",
            message="Insufficient data for drawdown analysis.",
        ))

    # ── 4. Risk-of-Ruin ──────────────────────────────────────────────────────
    if losing and summary.starting_balance and summary.starting_balance > 0:
        avg_loss_per_trade = sum(abs(v) for v in losing) / len(losing)
        avg_loss_pct_of_balance = avg_loss_per_trade / summary.starting_balance

        if 0 < avg_loss_pct_of_balance < 1:
            try:
                n_to_ruin = math.ceil(math.log(0.10) / math.log(1.0 - avg_loss_pct_of_balance))
            except (ValueError, ZeroDivisionError):
                n_to_ruin = None
        else:
            n_to_ruin = None

        if n_to_ruin is not None:
            if n_to_ruin < 5:
                checks.append(HealthCheck(
                    severity="red",
                    code="RISK_OF_RUIN",
                    title="Risk of Ruin",
                    message=(
                        f"Only ~{n_to_ruin} consecutive average losses would reduce the "
                        "account to 10% of its starting balance. Extreme danger."
                    ),
                    suggestion=(
                        "Drastically reduce per-trade risk by lowering stake size, "
                        "tightening Stop-Loss, or both. This strategy poses a high risk of account ruin."
                    ),
                ))
            elif n_to_ruin < 15:
                checks.append(HealthCheck(
                    severity="yellow",
                    code="RISK_OF_RUIN",
                    title="Risk of Ruin",
                    message=(
                        f"~{n_to_ruin} consecutive average losses would reduce the account "
                        "to 10% of starting balance. Drawdown streaks of this length do occur."
                    ),
                    suggestion=(
                        "Consider reducing your stake size per trade or adding a "
                        "max-drawdown kill switch to halt trading during losing streaks."
                    ),
                ))
            else:
                checks.append(HealthCheck(
                    severity="green",
                    code="RISK_OF_RUIN",
                    title="Risk of Ruin",
                    message=(
                        f"~{n_to_ruin} consecutive average losses needed to deplete the "
                        "account to 10%. Ruin risk is low given current loss sizes."
                    ),
                ))
        else:
            checks.append(HealthCheck(
                severity="green",
                code="RISK_OF_RUIN",
                title="Risk of Ruin",
                message="Could not estimate ruin risk from available trade data.",
            ))
    else:
        checks.append(HealthCheck(
            severity="green",
            code="RISK_OF_RUIN",
            title="Risk of Ruin",
            message="No losing trades recorded — ruin risk is negligible.",
        ))

    # ── Derive overall severity ──────────────────────────────────────────────
    severities = [c.severity for c in checks]
    if "red" in severities:
        overall = "red"
    elif "yellow" in severities:
        overall = "yellow"
    else:
        overall = "green"

    return HealthReport(overall_severity=overall, checks=checks)


@router.get(
    "/results/{run_id}",
    response_model=BacktestResultsResponse,
    summary="Get rich backtest results",
    description=(
        "Returns the full parsed results for a completed backtest run, "
        "including smart heuristic flags, exit reason breakdown, "
        "pair metrics, and individual trade list."
    ),
)
async def get_backtest_results(run_id: str, request: Request) -> BacktestResultsResponse:
    services = request.app.state.services

    try:
        run_dir = services.run_repository.find_run_dir(run_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")

    summary_raw = _read_json(run_dir / "parsed_summary.json")
    if summary_raw is None:
        metadata_raw = _read_json(run_dir / "metadata.json")
        status = (metadata_raw or {}).get("run_status", "unknown")
        if status == "failed":
            exit_code = (metadata_raw or {}).get("freqtrade_exit_code")
            code_hint = f" (exit code {exit_code})" if exit_code is not None else ""
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Backtest run '{run_id}' failed{code_hint} and produced no results. "
                    "Check the run logs for the error details."
                ),
            )
        if status in {"running", "queued", "downloading"}:
            raise HTTPException(
                status_code=202,
                detail=f"Run '{run_id}' is still in progress (status: {status}).",
            )
        if status == "cancelled":
            raise HTTPException(
                status_code=410,
                detail=f"Run '{run_id}' was cancelled before it completed.",
            )
        raise HTTPException(
            status_code=404,
            detail=f"No results found for run '{run_id}' (status: {status}). The run may still be in progress.",
        )

    try:
        summary = ParsedSummary.model_validate(summary_raw)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse summary: {exc}")

    pair_results_raw = _read_json(run_dir / "pair_results.json", default=[]) or []
    pair_results = [PairResult.model_validate(item) for item in pair_results_raw if isinstance(item, dict)]

    trades_raw = _read_json(run_dir / "trades.json", default=[]) or []
    trades = [BacktestTrade.model_validate(item) for item in trades_raw if isinstance(item, dict)]

    advanced_raw = _read_json(run_dir / "advanced_metrics.json")
    advanced = BacktestAdvancedMetrics.model_validate(advanced_raw) if advanced_raw else None

    smart_flags = _compute_smart_flags(summary, trades)
    health_report = _compute_health_report(summary, trades)

    return BacktestResultsResponse(
        run_id=run_id,
        parsed_summary=summary,
        pair_results=pair_results,
        trades=trades,
        advanced_metrics=advanced,
        smart_flags=smart_flags,
        health_report=health_report,
    )
