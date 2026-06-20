# tasks7.md — Backtest Gate Failure Analyzer

## 1. Goal

Create a deterministic helper that takes a `BacktestGateResult` (from Task 6), classifies the failure into one of 10 failure classes, and returns a recommended next route. No AI judgement, no threshold adjustment — just rule-based classification.

## 2. Why this task comes next

Task 6 (`backtest_gate.py`) already determines **if** a strategy fails and **which** gate rules it violates (`MIN_TRADES`, `MIN_WIN_RATE`, etc.). But callers (pipeline stages, auto-quant orchestrator, future endpoints) need a single structured answer:

- *What kind of failure is this?*
- *What should we do next?*

Without Task 7, every caller has to re-interpret the same list of failure codes, leading to duplicated logic and inconsistent routing. The failure analyzer centralizes this.

## 3. Existing files to reuse

| File | What it provides |
|------|------------------|
| `backend/services/execution/backtest_gate.py` | `BacktestGateResult` dataclass, `GATE_THRESHOLDS`, `_apply_gate_rules()` — the gate output that the analyzer classifies |
| `backend/services/execution/backtest_runner.py` | `BacktestRunner` — used by the gate, not changed here |
| `backend/services/storage/result_parser.py` | `ParsedSummary` — metrics source consumed by gate |
| `backend/models/runs.py` | `ParsedSummary` model — field names used to match metrics |
| `backend/services/auto_quant/pipeline_modules/scoring.py` | `determine_validation_status()` — existing pattern for status classification (can learn from but not reuse directly) |

## 4. Files likely to change

| File | Change |
|------|--------|
| `backend/services/execution/failure_analyzer.py` | **New** — standalone `analyze_gate_failure()` function + `FailureClassification` return type |
| `backend/tests/test_failure_analyzer.py` | **New** — unit tests for each failure class and routing |

No existing files are modified. The analyzer is a pure function over `BacktestGateResult` — it does not touch the gate, runner, parser, or pipeline.

## 5. Proposed helper name and location

**Location:** `backend/services/execution/failure_analyzer.py`

**Function:**
```python
def analyze_gate_failure(
    result: BacktestGateResult,
    metrics: dict[str, Any] | None = None,
) -> FailureClassification:
```

The function takes a `BacktestGateResult` (already produced by `run_backtest_gate()`) and optionally raw metrics if the caller wants to override what's in the result.

## 6. Failure classes

Classification logic (deterministic, applied in order):

| # | Failure class | Trigger | Priority |
|---|--------------|---------|----------|
| 1 | `data_quality_failed` | `result.gate_status == "data_quality_failed"` | 1 (highest) — checked first |
| 2 | `backtest_failed` | `result.gate_status == "backtest_failed"` | 2 — subprocess/parse crash |
| 3 | `no_trades` | `result.metrics.get("total_trades")` is None or 0 | 3 — no signal at all |
| 4 | `too_few_trades` | 0 < `total_trades` < `GATE_THRESHOLDS["min_trades"]` (10) | 4 |
| 5 | `negative_expectancy` | `expectancy` ≤ 0 (and not already classified as no/too_few_trades) | 5 |
| 6 | `high_drawdown` | `max_drawdown_pct` > `GATE_THRESHOLDS["max_drawdown_pct"]` (30.0) | 6 |
| 7 | `weak_profit_factor` | `profit_factor` < `GATE_THRESHOLDS["min_profit_factor"]` (1.05) | 7 |
| 8 | `weak_sharpe` | `sharpe_ratio` < `GATE_THRESHOLDS["min_sharpe_ratio"]` (0.5) | 8 |
| 9 | `weak_win_rate` | `win_rate_pct` < `GATE_THRESHOLDS["min_win_rate_pct"]` (40.0) | 9 |
| 10 | `multiple_metric_failure` | 2+ individual metric failures among classes 3–9 | Override — if triggered, becomes the primary class, individual failures listed as secondary |

**Rules:**
- `data_quality_failed` and `backtest_failed` are terminal — no individual metric analysis needed.
- `no_trades` and `too_few_trades` are checked **before** per-metric classes — if the trade count is too low, other metrics are unreliable.
- `multiple_metric_failure` overrides single-metric classes when 2+ of classes 3–9 apply. The individual failures are preserved as `secondary_classes`.
- If `gate_status == "passed"`, the analyzer returns `primary_class=None` and `next_route="none_needed"`.

## 7. Routing rules

Deterministic routing. No AI, no exceptions.

| Primary failure class | Next route | Rationale |
|----------------------|------------|-----------|
| `data_quality_failed` | `"check_data"` | Download/verify market data, check timerange coverage |
| `backtest_failed` | `"inspect_logs"` | Strategy syntax, Freqtrade config, subprocess error logs |
| `no_trades` | `"discard_strategy"` | Strategy produces zero signals — not salvageable |
| `too_few_trades` | `"extend_timerange_or_discard"` | May improve with more data, but likely signal issue |
| `negative_expectancy` | `"adjust_stoploss_or_roi"` | Per-trade expected value is negative — review risk parameters |
| `high_drawdown` | `"tighten_stoploss_or_position_sizing"` | Risk management is too loose |
| `weak_profit_factor` | `"adjust_exit_conditions"` | Winners not compensating for losers |
| `weak_sharpe` | `"review_entry_consistency"` | Returns are inconsistent |
| `weak_win_rate` | `"review_entry_logic"` | Too many losing trades |
| `multiple_metric_failure` | `"fundamental_rework"` | Multiple metrics fail — fundamental strategy problem |

Route recommendations are advisory. The caller (pipeline orchestrator, auto-quant, manual user) decides whether to act on them.

## 8. Return shape

```python
from dataclasses import dataclass, field
from typing import Literal

FailureClass = Literal[
    "data_quality_failed",
    "backtest_failed",
    "no_trades",
    "too_few_trades",
    "negative_expectancy",
    "high_drawdown",
    "weak_profit_factor",
    "weak_sharpe",
    "weak_win_rate",
    "multiple_metric_failure",
]

NextRoute = Literal[
    "none_needed",
    "check_data",
    "inspect_logs",
    "discard_strategy",
    "extend_timerange_or_discard",
    "adjust_stoploss_or_roi",
    "tighten_stoploss_or_position_sizing",
    "adjust_exit_conditions",
    "review_entry_consistency",
    "review_entry_logic",
    "fundamental_rework",
]


@dataclass
class FailureClassification:
    primary_class: FailureClass | None     # None when gate passed
    next_route: NextRoute                  # Single deterministic recommendation
    secondary_classes: list[FailureClass]  # Additional metric failures (empty unless multiple_metric_failure)
    failed_metrics: list[str]              # The original failure codes from gate (MIN_TRADES, etc.)
    metric_values: dict[str, float | None] # Snapshot of the 6 gate metrics at failure time
    gate_passed: bool                      # result.gate_status == "passed"
```

## 9. Tests needed

Create `backend/tests/test_failure_analyzer.py`:

| Test | What it covers |
|------|---------------|
| `test_analyzer_passed_gate` | `gate_status="passed"` → `primary_class=None`, `next_route="none_needed"` |
| `test_analyzer_data_quality_failed` | `gate_status="data_quality_failed"` → `primary_class="data_quality_failed"`, `next_route="check_data"` |
| `test_analyzer_backtest_failed` | `gate_status="backtest_failed"` → `primary_class="backtest_failed"`, `next_route="inspect_logs"` |
| `test_analyzer_no_trades` | `total_trades=0` → `primary_class="no_trades"`, `next_route="discard_strategy"` |
| `test_analyzer_too_few_trades` | `total_trades=3` → `primary_class="too_few_trades"`, `next_route="extend_timerange_or_discard"` |
| `test_analyzer_negative_expectancy` | `expectancy=-5.0`, other metrics OK → `primary_class="negative_expectancy"` |
| `test_analyzer_high_drawdown` | `max_drawdown_pct=45.0`, others OK → `primary_class="high_drawdown"` |
| `test_analyzer_weak_profit_factor` | `profit_factor=1.01`, others OK → `primary_class="weak_profit_factor"` |
| `test_analyzer_weak_sharpe` | `sharpe_ratio=0.1`, others OK → `primary_class="weak_sharpe"` |
| `test_analyzer_weak_win_rate` | `win_rate_pct=25.0`, others OK → `primary_class="weak_win_rate"` |
| `test_analyzer_multiple_metric_failure` | 3 metrics fail → `primary_class="multiple_metric_failure"`, `secondary_classes` lists all 3, `next_route="fundamental_rework"` |
| `test_analyzer_no_trades_takes_priority` | `total_trades=0` AND `expectancy=-5.0` → `primary_class="no_trades"`, not negative_expectancy |
| `test_analyzer_expectancy_zero_is_failure` | `expectancy=0.0` → `negative_expectancy` (not > 0) |
| `test_analyzer_none_metric_skipped` | `sharpe_ratio=None` → does not trigger `weak_sharpe` |

Run: `.venv/bin/pytest backend/tests/test_failure_analyzer.py -xvs`

## 10. What not to touch

- Do not modify `backtest_gate.py`, `backtest_runner.py`, `result_parser.py`, or `data_quality_gate.py`.
- Do not create API endpoints.
- Do not modify frontend.
- Do not modify pipeline files (`backend/services/auto_quant/pipeline_modules/`).
- Do not modify `SettingsModel` or any settings.
- Do not modify `strategy_code_writer.py` or `strategy_spec.py`.
- Do not integrate into pipeline stages — this task is the helper only.
- Do not use AI for classification or routing.
- Do not change the 6 existing gate metrics or their thresholds.
- Do not add HTTP/network calls.

## 11. First implementation task only

1. Create `backend/services/execution/failure_analyzer.py` with:
   - `FailureClass` and `NextRoute` type aliases
   - `FailureClassification` dataclass
   - `analyze_gate_failure(result: BacktestGateResult) -> FailureClassification` function
   - Classification order: data_quality → backtest → no_trades → too_few_trades → check all metrics → multiple_metric_failure override
   - Route mapping dict (class → route, deterministic lookup)
2. Create `backend/tests/test_failure_analyzer.py` with tests from §9.
3. Run: `.venv/bin/pytest backend/tests/test_failure_analyzer.py -xvs`
