# tasks10.md — Pair/Portfolio Workflow Audit

## 1. What already exists

| Layer | File | Status |
|-------|------|--------|
| Individual pair sweep (iterative) | `backend/services/execution/pair_sweep_runner.py` | Exists — multi-iteration random sampling, not exhaustive individual testing |
| Pair sweep persistence | `backend/services/storage/pair_sweep_store.py` | Exists — flat-file session/iteration storage |
| Pair selector UI/state | `backend/services/pairs/pair_selector.py` | Exists — manage selected/favorite/locked pairs, persist to JSON |
| Per-pair filtering (stage 1) | `pipeline_modules/stages_validation.py:_stage_pre_flight_filtering` | Exists — filters pairs by min_trades/min_profit_factor (discovery gates) |
| Per-pair ranking (stage 1) | `pipeline_modules/stages_validation.py:_stage_pre_selection` | Exists — sorts winning pairs by profit_total, selects TOP_PAIRS_SELECTION_COUNT |
| Portfolio baseline backtest | `pipeline_modules/stages_validation.py:_stage_portfolio_baseline` | Exists — joint backtest with max_open_trades constraint on user-approved pairs |
| Joint portfolio competition | `pipeline_modules/stages_assessment.py:_stage_joint_portfolio_backtest` | Exists — full portfolio backtest with ATR sizing, MC, weights |
| Final pair-set delivery | `pipeline_modules/stages_assessment.py:_stage_delivery` | Exists — injects approved pairs as `pair_whitelist` in config.json |

## 2. What is already connected to AutoQuant

AutoQuant pipeline has its **own internal pair workflow** that does NOT use `PairSweepRunner` or `PairSelectorService`:

- Stage 1: runs a single backtest on all pairs → extracts per-pair results → filters by thresholds → stores in `state.selected_pairs`
- Stage 2: runs portfolio baseline on `state.selected_pairs`
- Stage 4/5: runs joint portfolio backtest on `state.selected_pairs`
- Stage 6: delivers with `state.selected_pairs` in output

`PairSweepRunner` and `PairSelectorService` are **standalone** services with their own routers. They are not wired into AutoQuant.

## 3. What is missing

1. **Individual pair sweep (isolated)** — testing each pair one-by-one with `max_open_trades=1` to get clean per-pair metrics. `PairSweepRunner` does random multi-pair sampling per iteration, not exhaustive individual testing.
2. **Formal pair ranking step** — after individual sweep, rank pairs by combined metrics (profit factor, Sharpe, max DD, trade count) rather than just profit filtering.
3. **Seamless handoff** — ranked pair list → pair selector state → AutoQuant portfolio backtest stages. Currently these are disconnected.
4. **Final pair-set validation against the portfolio backtest result** — the current Stage 6 delivery injects the Stage 1 selected pairs blindly, without validating they survived the portfolio backtest.

## 4. Whether individual pair sweep exists

**Partially.** `PairSweepRunner` runs iterative backtests but:
- Each iteration tests a random sample of `max_open_trades` pairs together (not individually)
- Designed for multi-iteration Monte Carlo–style sweeps, not exhaustive per-pair isolation
- To do individual sweeps, you'd set `iteration_count=1` and `pair_pool=[single_pair]`, but this is not the intended use

A true individual pair sweep (each pair run alone with `max_open_trades=1`) does **not** exist as a named workflow.

## 5. Whether portfolio backtest exists

**Yes, in two places:**
- `_stage_portfolio_baseline` (Stage 2) — joint backtest with max_open_trades, user review checkpoint
- `_stage_joint_portfolio_backtest` (Stage 4/5) — full competition backtest with ATR sizing, MC simulation, capital starvation detection, weights

## 6. Whether final approved pair set is produced

**Yes, but naively.** Stage 6 delivery writes `state.selected_pairs` (from Stage 1 filtering) into `config.json` as `pair_whitelist`. It does not cross-reference with who survived the Stage 4/5 portfolio backtest.

## 7. Whether this can be reused for the new workflow

**Mostly yes.** Reuse:

| Want | Reuse |
|------|-------|
| Individual backtest per pair | `PairSweepRunner` with `max_open_trades=1`, `iteration_count=1`, single-pair pool (minor adaptation) |
| Pair ranking | `_stage_pre_selection` sorting logic + `PairSelectorService.set_selected()` to commit rankings |
| Portfolio backtest on approved set | `_stage_portfolio_baseline` + `_stage_joint_portfolio_backtest` (unchanged) |
| Final pair-set validation | `_stage_delivery` with cross-check against portfolio survivors |
| Pair state persistence | `PairSelectorService` state JSON (already used by frontend) |

## 8. Minimal integration needed

1. Create a `run_individual_pair_sweep()` function (or adapt `PairSweepRunner`) that iterates the pair pool, runs each with `max_open_trades=1`, collects per-pair metrics
2. Create a `rank_pairs()` function that scores pairs by combined metrics (PF × win_rate / max_DD) and writes to `PairSelectorService.selected_pairs`
3. Add a `portfolio_validation_cross_check` step in Stage 6 that ensures each injected pair survived the portfolio backtest (trade count > 0)
4. Wire the ranked pair list into AutoQuant pipeline state (`state.selected_pairs`)

## 9. What not to rebuild

- Do NOT rebuild `PairSweepRunner` — adapt it
- Do NOT rebuild `PairSelectorService` — use it
- Do NOT rebuild `_stage_portfolio_baseline` / `_stage_joint_portfolio_backtest` — they work
- Do NOT rebuild `_stage_delivery` — add the cross-check
- Do NOT rebuild the backtest subprocess wrapper (`BacktestRunner`)
- Do NOT rebuild the per-pair extraction helpers (`_extract_per_pair_results`, `_extract_backtest_summary`)

## 10. First implementation task only

**Create `run_individual_pair_sweep()` in `pair_sweep_runner.py`** — add a method that takes a pair list, runs each pair individually with `max_open_trades=1`, collects metrics (profit, trades, win_rate, max_dd, profit_factor) into a dict keyed by pair, and returns the sorted ranking. The method signature:

```python
async def run_individual_pair_sweep(
    self, pairs: list[str], config_file: str, timerange: str, timeframe: str,
    strategy_name: str, fee_rate: float, dry_run_wallet: float,
) -> list[dict]:  # sorted by score descending
```

Each iteration: sets `pair_pool=[pair]`, `max_open_trades=1`, runs backtest via `backtest_runner.queue_strategy_backtest()`, extracts metrics via `_extract_iteration_metrics()`. Score formula: `profit_factor * win_rate / max(0.01, max_drawdown)`.
