# tasks8.md — Repair Plan Gate

## 1. Goal

Convert a `FailureClassification` (from Task 7) into a safe, deterministic repair permission plan. The plan defines what AI will be allowed to change, what is forbidden, and when to give up — without executing any repairs.

## 2. Why this task comes next

Task 7 classifies *what* went wrong. The repair plan gate decides *what AI may touch* if a repair is attempted later. Without this gate, the AI would have unbounded permission to rewrite any parameter, any logic block — introducing unknown risk. The gate constrains AI to exactly one variable or one logic block per iteration, enforces iteration limits, and blocks non-repairable failures before they reach the AI.

## 3. Existing files to reuse

| File | What it provides |
|------|------------------|
| `backend/services/execution/failure_analyzer.py` | `FailureClassification` dataclass, `FailureClass` / `NextRoute` literals — the input to the plan gate |
| `backend/services/execution/backtest_gate.py` | `BacktestGateResult`, `GATE_THRESHOLDS` — gate output consumed by analyzer |
| `backend/models/strategy_spec.py` | `StrategySpec` — has `max_iterations`, `iteration_count`, `stoploss`, `roi`, `entry_conditions`, `exit_conditions`, `trailing` — the fields that repairs may touch |
| `backend/models/runs.py` | `ParsedSummary` — metrics source consumed by gate |

## 4. Files likely to change

| File | Change |
|------|--------|
| `backend/services/execution/repair_plan_gate.py` | **New** — `build_repair_plan()` function + `RepairPlan` return type |
| `backend/tests/test_repair_plan_gate.py` | **New** — unit tests for each failure class → repair scope mapping |

## 5. Proposed helper function name and location

**Location:** `backend/services/execution/repair_plan_gate.py`

**Function:**
```python
def build_repair_plan(
    classification: FailureClassification,
    spec: StrategySpec | None = None,
) -> RepairPlan:
```

The function takes a `FailureClassification` (from `analyze_gate_failure()`) and optionally the current `StrategySpec` to read `iteration_count` and `max_iterations`.

## 6. Repair scopes

Each scope defines exactly what AI may change in one repair iteration.

| Scope | What AI may change | Constraint |
|-------|-------------------|------------|
| `no_repair_possible` | Nothing — terminal | Route to discard/fundamental_rework |
| `entry_logic` | One logic block: one `entry_conditions` element or one indicator param | Exactly one change |
| `exit_logic` | One logic block: one `exit_conditions` element or `trailing_stop` toggle | Exactly one change |
| `stoploss` | `stoploss` float value only | New value must stay in [-0.50, -0.01] |
| `roi` | One ROI table entry (add/remove/change one `(minutes, ratio)` pair) | Must preserve monotonic minutes |
| `position_sizing` | `max_open_trades` or `position_sizing.method` or sizing params | One field only |
| `entry_parameter` | One indicator parameter value (e.g., `rsi.period=14` → `rsi.period=10`) | One param only |
| `final_reject` | Nothing — iteration limit reached or unrecoverable | Terminal |

## 7. Routing / permission rules

Deterministic mapping from failure class → default repair scope:

| Failure class | Default scope | Rationale |
|---------------|--------------|-----------|
| `data_quality_failed` | `no_repair_possible` | Data problem, not strategy problem |
| `backtest_failed` | `no_repair_possible` | Infra/crash problem, not strategy |
| `no_trades` | `entry_logic` | Strategy produces no signals — entry logic is the likely cause |
| `too_few_trades` | `entry_parameter` | Tweak one indicator param to generate more signals |
| `negative_expectancy` | `stoploss` | Per-trade loss — tighten stoploss or adjust ROI |
| `high_drawdown` | `stoploss` | Risk too loose — tighten stoploss or position sizing |
| `weak_profit_factor` | `exit_logic` | Winners not compensating losers — review exit |
| `weak_sharpe` | `entry_parameter` | Inconsistent returns — tweak one indicator |
| `weak_win_rate` | `entry_logic` | Too many losers — refine entry |
| `multiple_metric_failure` | `no_repair_possible` | Too many things broken — fundamental rework needed |

**Override rules (applied after default):**
- If `spec` is provided and `spec.iteration_count >= spec.max_iterations`: scope becomes `final_reject` regardless of failure class.
- `no_trades` reverts to `final_reject` after 1 repair attempt (check `spec.iteration_count >= 1`).
- `lookahead`-style failures (not yet classified by analyzer, placeholder for future) → default to `no_repair_possible`.

## 8. Iteration limit rule

```
if spec and spec.iteration_count >= spec.max_iterations:
    scope = "final_reject"
```

The `StrategySpec.max_iterations` field (default 3) caps total repair rounds. When exhausted, the plan gate returns `final_reject` — the AI must not be called.

## 9. Return shape

```python
from dataclasses import dataclass, field
from typing import Literal

RepairScope = Literal[
    "no_repair_possible",
    "entry_logic",
    "exit_logic",
    "stoploss",
    "roi",
    "position_sizing",
    "entry_parameter",
    "final_reject",
]


@dataclass
class RepairPlan:
    scope: RepairScope
    failure_class: FailureClass | None
    next_route: NextRoute
    max_iterations: int         # From spec or default 3
    iteration_used: int         # From spec.iteration_count or 0
    iterations_remaining: int   # max_iterations - iteration_used
    can_repair: bool            # True when scope not no_repair_possible/final_reject
    reason: str                 # Human-readable summary of why this scope
```

## 10. Tests needed

Create `backend/tests/test_repair_plan_gate.py`:

| Test | What it covers |
|------|---------------|
| `test_data_quality_no_repair` | `data_quality_failed` → `scope="no_repair_possible"`, `can_repair=False` |
| `test_backtest_failed_no_repair` | `backtest_failed` → `scope="no_repair_possible"`, `can_repair=False` |
| `test_no_trades_entry_logic` | `no_trades` with fresh spec → `scope="entry_logic"`, `can_repair=True` |
| `test_no_trades_exhausted` | `no_trades` with `iteration_count=1`, `max_iterations=3` → `scope="entry_logic"` still (first retry allowed) |
| `test_no_trades_final_reject_after_one` | `no_trades` with `iteration_count=2` → `scope="final_reject"` (only 1 repair allowed) |
| `test_too_few_trades_entry_param` | `too_few_trades` → `scope="entry_parameter"` |
| `test_negative_expectancy_stoploss` | `negative_expectancy` → `scope="stoploss"` |
| `test_high_drawdown_stoploss` | `high_drawdown` → `scope="stoploss"` |
| `test_weak_profit_factor_exit` | `weak_profit_factor` → `scope="exit_logic"` |
| `test_weak_sharpe_entry_param` | `weak_sharpe` → `scope="entry_parameter"` |
| `test_weak_win_rate_entry_logic` | `weak_win_rate` → `scope="entry_logic"` |
| `test_multiple_metric_no_repair` | `multiple_metric_failure` → `scope="no_repair_possible"` |
| `test_max_iterations_reached` | Any class with `iteration_count >= max_iterations` → `scope="final_reject"` |
| `test_iterations_remaining_correct` | `max_iterations=3`, `iteration_count=1` → `iterations_remaining=2` |
| `test_no_spec_uses_defaults` | `spec=None` → `max_iterations=3`, `iteration_used=0` |

## 11. What not to touch

- Do not modify `failure_analyzer.py`, `backtest_gate.py`, `backtest_runner.py`, `result_parser.py`, or `data_quality_gate.py`.
- Do not call Ollama or any AI service.
- Do not modify `strategy_spec.py`, `strategy_spec_flow.py`, or `strategy_code_writer.py`.
- Do not create API endpoints.
- Do not modify frontend.
- Do not modify pipeline files (`backend/services/auto_quant/pipeline_modules/`).
- Do not modify `SettingsModel` or any settings.
- Do not execute repairs — this task only defines *what is allowed*.
- Do not add HTTP/network calls.

## 12. First implementation task only

1. Create `backend/services/execution/repair_plan_gate.py` with:
   - `RepairScope` type alias
   - `RepairPlan` dataclass
   - `build_repair_plan(classification, spec=None) -> RepairPlan` function
   - Default scope mapping dict (failure class → repair scope)
   - Override logic: iteration limit check, no_trades re-repair cap
   - `can_repair` boolean derivation
2. Create `backend/tests/test_repair_plan_gate.py` with tests from §10.
3. Run: `.venv/bin/pytest backend/tests/test_repair_plan_gate.py -xvs`
