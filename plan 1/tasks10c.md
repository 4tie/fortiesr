# Task 10C: Final Pair Set Decision

## Goal

Create `decide_final_pair_set()` — a deterministic backend helper that takes individual pair sweep results + portfolio backtest result and returns the final approved pair set with a pass/fail verdict.

## Why This Comes Next

`run_individual_pair_sweep()` (Task 10A) ranks pairs in isolation. `run_portfolio_backtest()` (Task 10B) tests them jointly. Neither decides which pairs are **finally approved**. The gap is a rule-based decision layer that cross-references both outputs, enforces risk profile rules, respects a minimum pair count, and produces a single final set.

## Existing Files to Reuse

| File | What to Reuse |
|------|---------------|
| `backend/services/execution/pair_sweep_runner.py:532` | `run_individual_pair_sweep()` output — sorted `list[dict]` with `pair`, `status`, `score`, `profit_factor`, `win_rate`, `max_drawdown`, `total_trades`, `expectancy`, `profit_total` |
| `backend/services/execution/pair_sweep_runner.py:699` | `run_portfolio_backtest()` output — `dict` with `status`, `failure_reasons`, `portfolio_summary`, `per_pair_metrics` |
| `backend/services/execution/backtest_gate.py:17` | `GATE_THRESHOLDS` — `min_trades`, `min_win_rate_pct`, `min_profit_factor`, `max_drawdown_pct` |
| `backend/services/auto_quant/pipeline_modules/config.py:104-110` | `MAX_DRAWDOWN_THRESHOLD`, `MIN_WIN_RATE`, `MIN_PROFIT_FACTOR`, `MIN_SHARPE` |

## Files Likely to Change

1. `backend/services/execution/pair_sweep_runner.py` — add `decide_final_pair_set()` function
2. `backend/tests/test_pair_sweep_runner.py` — unit tests for decision logic

No frontend, no router, no pipeline, no model changes.

## Proposed Helper

**Function**: `decide_final_pair_set()` (standalone, module-level, not a method)

**Location**: `backend/services/execution/pair_sweep_runner.py` (bottom, ~120 lines)

Keep it a standalone function (not a `PairSweepRunner` method) because it has no runner dependencies — it just reads dicts and applies rules.

## Inputs

```python
def decide_final_pair_set(
    individual_results: list[dict],     # output of run_individual_pair_sweep()
    portfolio_result: dict,             # output of run_portfolio_backtest()
    risk_profile: str = "moderate",     # "conservative" | "moderate" | "aggressive"
    min_approved_pairs: int = 3,        # floor — fail if fewer qualify
) -> dict:
```

`individual_results` must already be filtered to `"passed"` status entries (caller responsibility). `portfolio_result` must already be the full dict from `run_portfolio_backtest()`.

## Decision Flow

1. **Quick reject** — if `portfolio_result["status"]` is `"backtest_failed"`, return immediately with `approved_pairs=[]`, `verdict="rejected"`, `reason="Portfolio backtest failed to execute"`.

2. **Build lookup** — index `portfolio_result["per_pair_metrics"]` by pair name for O(1) cross-reference.

3. **Score candidates** — for each passed individual result:
   - Look up portfolio pair data by pair name
   - Compute a combined score: `individual_score * portfolio_penalty`
   - `portfolio_penalty` = `0.5` if pair had 0 trades in portfolio, `1.0` if positive profit, `0.8` if non-negative/no data

4. **Filter by risk profile rules** (see below)

5. **Rank survivors** by combined score descending

6. **Apply minimum count check**:
   - If survivors < `min_approved_pairs`: return with `verdict="rejected"`, `reason="Only N pairs qualified (minimum M)"`
   - Otherwise: return top `min_approved_pairs` survivors (or all survivors if caller provided more)

7. **Apply portfolio-level override** — if `portfolio_result["status"]` is `"failed"` and portfolio failure reasons include `"MIN_PROFIT_FACTOR"` or `"MAX_DRAWDOWN"`, the entire decision is rejected regardless of individual scores.

## Risk Profile Rules

Applied after the score-based candidate pool is built (Step 3).

| Profile | Rule | Effect |
|---------|------|--------|
| `conservative` | Drop pairs where individual `max_drawdown >= 15%` OR portfolio `profit_factor < 1.0` OR portfolio trades == 0 | Highest confidence only |
| `moderate` | Drop pairs where individual `max_drawdown >= 25%` OR (portfolio profit_factor < 0.8 AND portfolio trades == 0) | Default |
| `aggressive` | Drop pairs where individual `max_drawdown >= 35%` OR individual `total_trades == 0` | Maximize pair count |

Thresholds compared against `None`-safe values (treat `None` as 0 for `total_trades`, as `float("inf")` for drawdown, as 0 for profit_factor).

## Return Shape

```python
{
    "verdict": str,                     # "approved" | "rejected"
    "approved_pairs": list[str],        # empty if rejected; ordered by score desc
    "approved_count": int,              # len(approved_pairs)
    "min_approved_pairs": int,          # what was requested
    "risk_profile": str,                # which profile was used
    "rejection_reason": str | None,     # None if approved
    "combined_scores": [                # all candidates that survived individual sweep
        {
            "pair": str,
            "individual_score": float,
            "portfolio_penalty": float,
            "combined_score": float,
            "individual_max_drawdown": float | None,
            "portfolio_trades": int | None,
            "portfolio_profit_factor": float | None,
            "survived_risk_filter": bool,
        }
    ],
    "portfolio_verdict": str,           # passed/failed/backtest_failed from portfolio result
    "portfolio_failure_reasons": list[str],
}
```

## Tests Needed

1. **Unit: full approval path** — supply 10 individual passed results + portfolio passed. Conservative profile, min_approved=3. Assert 3 pairs returned, all with `survived_risk_filter=True`, `verdict="approved"`.
2. **Unit: conservative filter** — individual results include a pair with `max_drawdown=20`. Assert it is dropped by conservative profile but would survive moderate.
3. **Unit: portfolio-level override** — portfolio result has `status="failed"` with `"MAX_DRAWDOWN"` in reasons. Assert `verdict="rejected"` regardless of individual scores.
4. **Unit: not enough survivors** — min_approved=5 but only 3 survive conservative filter. Assert `verdict="rejected"`.
5. **Unit: backtest_failed portfolio** — portfolio result has `status="backtest_failed"`. Assert immediate `verdict="rejected"` with `approved_pairs=[]`.
6. **Unit: aggressive profile** — aggressive profile allows higher drawdown. Confirm pairs with `max_drawdown=30` survive aggressive but not conservative.

## What Not to Touch

- Do not modify `PairSweepRunner` class or its existing methods
- Do not modify `run_individual_pair_sweep()` — its output is input only
- Do not modify `run_portfolio_backtest()` — its output is input only
- Do not write results to `PairSelectorService`
- Do not modify pipeline stages or AutoQuant orchestration
- Do not invoke AI (Ollama)
- Do not select new pairs or run backtests
- Do not create endpoints or modify frontend
- Do not add risk profile enums to models/contracts.py — use a simple string param with inline rules

## First Implementation Task Only

1. Add standalone `decide_final_pair_set()` function at the bottom of `pair_sweep_runner.py`
2. Write the 6 unit tests in `backend/tests/test_pair_sweep_runner.py`
3. Run `pytest backend/tests/test_pair_sweep_runner.py -xvs` to verify
