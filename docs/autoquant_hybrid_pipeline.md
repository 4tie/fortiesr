# AutoQuant Hybrid Pipeline — Exhaustive Technical Documentation

> **Last updated:** June 2026  
> **Stack:** FastAPI + uvicorn (port 8000) · React + Vite (port 5000) · freqtrade 2026.4  
> **Exchange:** Binance · **Pairs:** BTC/USDT ETH/USDT SOL/USDT BNB/USDT XRP/USDT ETC/USDT · **Timeframe:** 5m

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & File Map](#2-architecture--file-map)
3. [Pipeline State Machine](#3-pipeline-state-machine)
4. [Stage 1 — Pre-Flight Filtering](#4-stage-1--pre-flight-filtering)
5. [Stage 2 — WFA Hyperopt](#5-stage-2--wfa-hyperopt)
6. [Stage 3 — Robustness & Feature Injection](#6-stage-3--robustness--feature-injection)
7. [Stage 4 — Portfolio Competition](#7-stage-4--portfolio-competition)
8. [Stage 5 — Delivery](#8-stage-5--delivery)
9. [Cross-Cutting Concerns](#9-cross-cutting-concerns)
10. [Frontend — AutoQuantTab.jsx](#10-frontend--autoquanttabjsx)
11. [WebSocket Event Reference](#11-websocket-event-reference)
12. [Configuration Reference](#12-configuration-reference)
13. [Failure Modes & Recovery](#13-failure-modes--recovery)

---

## 1. System Overview

The AutoQuant Hybrid Pipeline is a fully autonomous, end-to-end quantitative trading strategy optimisation engine. Starting from raw OHLCV data on disk, it produces a production-ready freqtrade strategy file with position sizing, trailing stops, and trading-window filters baked in.

### What it does in one sentence

Given a base strategy and date range, it:
1. heals data gaps,
2. selects only profitable pairs,
3. hyperoptimises parameters with Walk-Forward Analysis,
4. stress-tests the result against slippage and fee escalation,
5. competes pairs for capital under a joint portfolio constraint,
6. validates risk via Monte Carlo simulation, and
7. delivers a fully-annotated `.py` strategy file with `custom_stake_amount` and `custom_stoploss`.

### Key design decisions

| Decision | Rationale |
|---|---|
| All stages are sequential coroutines | Allows cancellation at any checkpoint; no shared mutable state between stages |
| Self-healing retry loop wraps Stages 2–3 | Sharp-peak parameters are rejected before they reach live capital |
| Hard Mutation vs. Soft Mutation | When the baseline is negative, Boolean indicators are forced `True` and epochs doubled; sharp peaks use loss-function rotation |
| Non-blocking drawdown gateway | Portfolio drawdown warning is emitted over WebSocket but does not halt the pipeline |
| Dual-factor position sizing | ATR-volatility normalisation × stability score produces pair-aware Kelly-like sizing |

---

## 2. Architecture & File Map

```
backend/services/auto_quant/
├── pipeline_modules/
│   ├── orchestrator.py          ← run_pipeline() entry point
│   ├── stages_validation.py     ← Stages 1 & 3
│   ├── stages_optimization.py   ← Stage 2 (hyperopt + patch)
│   ├── stages_assessment.py     ← Stages 4 & 5
│   ├── data_healer.py           ← Sub-step 1.1
│   ├── filters.py               ← Pair filtering, trading-window analysis
│   ├── helpers.py               ← Shared subprocess, backtest, emit utilities
│   ├── state.py                 ← PipelineState dataclass + queue/state registry
│   ├── logging.py               ← Per-run structured logging (_rlog)
│   └── config.py                ← Thresholds, TOP_PAIRS_SELECTION_COUNT
├── monte_carlo.py               ← run_monte_carlo()
├── sensitivity.py               ← run_sensitivity_check()
├── profit_lockin.py             ← compute_profit_giveback_metrics()
├── ollama_service.py            ← ask_ollama_for_sensitivity_fix()
└── ...

frontend/src/components/
└── AutoQuantTab.jsx             ← All UI: config form, live stepper, charts, report

user_data/
├── config.json                  ← Base freqtrade config (exchange, pairs, stake)
├── data/binance/
│   └── PAIR_QUOTE-5m.feather   ← Flat feather files (date/open/high/low/close/volume)
└── auto_quant/
    └── <run_id>/               ← Per-run output directory
        ├── stage1_result*.json
        ├── stage2_hyperopt*.json
        ├── stage3_stress_*.json
        ├── stage4_portfolio*.json
        ├── stage4_result.json   ← OOS backtest trades (used by MC + giveback)
        ├── report.json
        ├── config.json          ← Optimised config (ready to deploy)
        └── <Strategy>_Optimized.py
```

### Data flow summary

```
Feather files → Data Healer → Baseline Backtest
                                    ↓
                          Top-N Pair Selection
                                    ↓
                    ┌─── Hyperopt (WFA) ←────────────────────────────┐
                    │         ↓                                       │
                    │   Sensitivity Check ──── FAIL ────► Self-Heal  │
                    │         ↓ PASS                       (retry)   │
                    │   Auto-Patch                                    │
                    │         ↓                                       │
                    │   Slippage Stress Tests (1×/2×/3× fees)        │
                    │         ↓                                       │
                    │   Stability Scores + Feature Injection          │
                    └─────────────────────────────────────────────────┘
                                    ↓
                     Joint Portfolio Backtest + Sizing
                                    ↓
                         Monte Carlo (1 000 shuffles)
                                    ↓
                          Delivery (strategy.py + report)
```

---

## 3. Pipeline State Machine

### PipelineState fields (key subset)

| Field | Type | Description |
|---|---|---|
| `run_id` | `str` | UUID-like run identifier |
| `status` | `str` | `pending → running → completed / failed / cancelled / interrupted` |
| `strategy` | `str` | Base strategy class name |
| `timeframe` | `str` | e.g. `5m` |
| `in_sample_range` | `str` | `YYYYMMDD-YYYYMMDD` |
| `out_sample_range` | `str` | `YYYYMMDD-YYYYMMDD` |
| `pair_universe` | `list[str]` | All pairs passed to Stage 1 |
| `selected_pairs` | `list[dict]` | Top-N pairs surviving Stage 1 |
| `winning_pairs` | `list[dict]` | Pairs surviving Stage 3 stress test |
| `stability_scores` | `dict[str,float]` | Per-pair `[0,100]` stability score from Stage 3 |
| `portfolio_weights` | `dict[str,float]` | Normalised sizing weights from Stage 4 |
| `retry_count` | `int` | Number of Stage 2–3 retries so far |
| `max_retries` | `int` | Default 3; after this, `generalization_failure` is set |
| `retry_history` | `list[dict]` | Per-attempt record (loss fn, spaces, result, reason) |
| `generalization_failure` | `dict\|None` | Set on exhaustion; carries attempts, best attempt, suggestions |
| `sensitivity` | `dict\|None` | Latest sensitivity check result |
| `excluded_time_windows` | `dict` | `{excluded_hours: [], excluded_days: []}` |
| `ensemble_enabled` | `bool` | Whether ensemble signal weights are hyperoptimised |
| `baseline_trade_counts` | `dict[str,int]` | Trade counts from Stage 1 (capital starvation reference) |
| `report` | `dict\|None` | Final assembled report (set in Stage 5) |

### Legal status transitions

```
pending → running → completed   (terminal)
                  → failed      (terminal)
                  → cancelled   (terminal)
                  → interrupted → running  (resume possible)
```

The frontend enforces these transitions via `LEGAL_STATUS_TRANSITIONS` and `isValidStatusTransition()` before applying any WebSocket update.

---

## 4. Stage 1 — Pre-Flight Filtering

**Entry point:** `_stage_pre_flight_filtering()` in `stages_validation.py`  
**Orchestrator call:** `s1_result = await _stage_pre_flight_filtering(run_id, state, out_dir)`  

This is a unified stage combining two sequential sub-steps: data healing and baseline backtest + pair pre-selection.

### Sub-step 1.1 — Data Healing

**Entry point:** `_stage_data_healing()` in `data_healer.py`

#### Purpose

Ensures every pair in `state.pair_universe` has gap-free OHLCV data covering the combined IS+OOS window before any backtest runs.

#### File-path resolution

Freqtrade stores data as **flat feather files** (not nested directories):

```
user_data/data/binance/BTC_USDT-5m.feather
```

The healer constructs this path as:
```python
pair_safe = pair.replace("/", "_")
path = Path(data_dir) / f"{pair_safe}-{timeframe}.feather"
```

#### Candle parsing

Each feather row is a list `[timestamp_ms, open, high, low, close, volume]` (not a dict). The healer reads with:
```python
df = pd.read_feather(path)
```
The `date` column is `datetime64[ms, UTC]`.

#### Gap detection & triage

For each pair the healer:
1. Converts the required window to UTC timestamps.
2. Computes the actual data coverage from the file.
3. Calculates `gap_seconds` at the start and end of the window.
4. Classifies the result with a three-way decision:

| Condition | Action |
|---|---|
| `_is_only_start_boundary_gap()` returns `True` | **Accept** — the gap is just the exchange's first-candle boundary |
| Internal gap or large leading gap | **Reject** — trigger download attempt |
| End gap | Warn; continue |

#### Exchange-bounded start gap (`_is_only_start_boundary_gap`)

A pair passes even if its earliest candle is after the requested IS start, provided **all three** conditions hold:
- The gap is only at the leading edge (no gaps inside the window, no trailing gap).
- The missing duration is ≤ 30 days.
- The data starts at or before the IS start date (i.e. exchange listing preceded IS start).

This prevents false failures for newly-listed tokens whose exchange history genuinely starts mid-window.

#### Auto-download

If a pair is rejected, the healer spawns a `freqtrade download-data` subprocess:
```bash
freqtrade download-data \
  --config <config> \
  --pairs PAIR/QUOTE \
  --timerange YYYYMMDD-YYYYMMDD \
  --timeframe 5m \
  --user-data-dir <user_data_dir>
```
After download it re-validates. If still unhealthy, the pair is **dropped** from `state.pair_universe` and a warning is emitted.

#### Healing outcome

- Healthy pairs continue to the baseline backtest.
- Unhealthy pairs that could not be healed are silently dropped.
- If all pairs are dropped, Stage 1 fails immediately.

### Sub-step 1.2 — Baseline Backtest + Pre-Selection

**Entry point:** `_stage_pre_selection()` in `stages_validation.py`

#### Backtest execution

Runs freqtrade backtesting across all healed pairs over the IS range:
```bash
freqtrade backtesting \
  --config <config> \
  --strategy <strategy> \
  --timerange <in_sample_range> \
  --timeframe 5m \
  --pairs <all_healed_pairs> \
  --export trades \
  --export-filename <out_dir>/stage1_result.json \
  --no-color \
  --cache none
```

#### Pair filtering (`_filter_winning_pairs`)

Pairs must pass **both** of the following timeframe-aware gates (from `config.py::get_timeframe_thresholds()`):

| Threshold | Meaning |
|---|---|
| `min_profit_factor` | Gross wins / gross losses ≥ threshold |
| `min_trade_count` | Minimum number of closed trades |

The thresholds vary by timeframe; tighter intervals require more trades to be statistically meaningful.

#### Top-N selection

Winning pairs are sorted by `profit_total` descending; the top `TOP_PAIRS_SELECTION_COUNT` are stored in `state.selected_pairs`. If fewer than `TOP_PAIRS_SELECTION_COUNT` pairs pass, Stage 1 **fails** with an `insufficient_pairs` error.

#### Baseline trade counts

The trade count for each selected pair is saved to `state.baseline_trade_counts`. This reference is used in Stage 4 to detect **capital starvation** (pairs that are crowded out when `max_open_trades` is applied).

#### Trading-window analysis (`_analyze_trading_windows`)

Also inside Stage 1, the healer analyses trade timestamps to identify systematically losing hours and days of the week:
- Hours and days where the strategy's win-rate falls below a configurable threshold are flagged.
- Results are stored in `state.excluded_time_windows = {"excluded_hours": [...], "excluded_days": [...]}`.
- These are injected into the final strategy file in Stage 5.

#### Stage 1 pass criteria

- `selected_pairs` length ≥ `TOP_PAIRS_SELECTION_COUNT`
- At least one pair passed the profit-factor and trade-count gates

#### Stage 1 output shape

```json
{
  "profit_total_abs": 123.45,
  "max_drawdown_account": 0.12,
  "total_trades": 340,
  "per_pair": [...],
  "winning_pairs": ["BTC/USDT", ...],
  "failing_pairs": ["ETC/USDT"],
  "selected_pairs": ["BTC/USDT", "ETH/USDT", ...]
}
```

---

## 5. Stage 2 — WFA Hyperopt

**Entry points:** `_stage_hyperopt()` + `_stage_patch()` in `stages_optimization.py`  
**Orchestrator:** wraps both inside the self-healing retry loop.

### 5.1 Hyperopt execution

```bash
freqtrade hyperopt \
  --config <config> \
  --strategy <strategy> \
  --timerange <in_sample_range> \
  --timeframe 5m \
  --pairs <selected_pairs> \
  --hyperopt-loss <state.hyperopt_loss> \
  --spaces <state.hyperopt_spaces> \
  --epochs <state.hyperopt_epochs> \
  --user-data-dir <user_data_dir> \
  --no-color
```

Default values (can be changed by the self-healing loop):

| Parameter | Default |
|---|---|
| `hyperopt_loss` | `SharpeHyperOptLoss` |
| `hyperopt_spaces` | `["buy", "sell", "roi", "stoploss"]` |
| `hyperopt_epochs` | 100 (configurable) |

#### Walk-Forward Analysis (WFA)

The hyperopt stage implements WFA by splitting the IS window into `N` overlapping sub-windows. For each window it:
1. Runs hyperopt on the in-sample slice.
2. Validates on the held-out OOS slice.
3. Assigns a `recency_weight` to each window (more recent windows get higher weight).
4. Reports `profit`, `max_dd`, `trades`, `is_range`, `oos_range` per window.

Window results are emitted as `wfo_window_result` WebSocket events and displayed in the `WfoWindowsTable` component.

#### Ensemble mode

When `state.ensemble_enabled` is `True`, the hyperopt spaces include four additional float parameters:
- `rsi_weight`, `macd_weight`, `bb_weight` — signal contribution weights
- `consensus_threshold` — fraction of weighted signal needed to trigger a buy

These are extracted from `best_params["params_dict"]` and injected into the final strategy file.

#### Best-params extraction

After hyperopt completes, the runner parses the `hyperopt_results.json` to find the epoch with the minimum objective (freqtrade convention: objective = negative Sharpe or similar). The top-N candidate epochs are stored and emitted as `hyperopt_top_candidates`.

### 5.2 Sensitivity / Robustness Check

Immediately after hyperopt, before patching, the orchestrator runs:
```python
sensitivity_result = await run_sensitivity_check(best_params, out_dir, run_id, state)
```

#### What it measures

For the most important hyperopt parameter (`param`), three backtests are run:
- `p_best`: best parameter value (as found by hyperopt)
- `p_minus`: value perturbed by −5%
- `p_plus`: value perturbed by +5%

#### Scoring

| Condition | Score | Label |
|---|---|---|
| `p_minus` and `p_plus` both positive, variation < 25% | `High` | Stable Plateau Detected |
| One is positive, variation 25–50% | `Medium` | Moderate Sensitivity |
| `p_best ≤ 0` | — | `FAIL_NEGATIVE_BASELINE` |
| Variation > 50% | `Low` | Sharp Peak |

`passed = score in {"High", "Medium"}`

#### Self-healing retry loop

When `sensitivity_result["passed"]` is `False`, the orchestrator does **not** halt — it mutates hyperopt configuration and retries:

**FAIL_NEGATIVE_BASELINE → Hard Mutation:**
```python
state.param_overrides = {"use_ema_cross": True, "use_atr": True, "use_adx": True}
state.hyperopt_spaces = ["buy", "stoploss", "roi"]
state.hyperopt_epochs *= 2
state.hyperopt_loss = "SharpeHyperOptLoss"
```

**Sharp Peak → Soft Mutation (retry N):**

| Retry | Loss function | Spaces |
|---|---|---|
| 1 | `SharpeHyperOptLoss` | unchanged |
| 2 | `CalmarHyperOptLoss` (if drawdown) or `ProfitDrawDownHyperOptLoss` | `["roi","stoploss"]` |
| 3+ | same or Ollama-suggested | +50% epochs |

**Ollama-assisted retry** (when `ollama_self_healing_enabled: true` in `strategy_lab_settings.json`):
- `ask_ollama_for_sensitivity_fix()` is called with the sensitivity result and the retry history.
- If Ollama returns a valid JSON suggestion, its `hyperopt_loss`, `hyperopt_spaces`, `hyperopt_epochs`, and `param_overrides` overwrite the state.
- The UI shows the AI badge and reasoning per attempt in `RetryHistoryTable`.

**Exhaustion:** After `max_retries` attempts, `state.generalization_failure` is set and Stage 2 fails with a structured diagnostics payload. The best attempt's strategy file is preserved for download.

### 5.3 Auto-Patch

**Entry point:** `_stage_patch()` in `stages_optimization.py`

After sensitivity passes, the patcher:
1. Reads the base strategy source file.
2. Applies the best hyperopt parameters (ROI table, stoploss, trailing stops, buy/sell indicator parameters) as Python class attributes.
3. Writes `<Strategy>_Optimized.py` into `out_dir`.
4. Returns the path to the patched file as `optimized_path`.

---

## 6. Stage 3 — Robustness & Feature Injection

**Entry point:** `_stage_robustness_feature_injection()` in `stages_validation.py`

This stage serves two distinct purposes: stress-testing the optimised strategy against elevated transaction costs, and injecting production-grade protective features into the strategy source.

### Sub-step 3.1 — OOS Backtest (baseline)

Runs the patched strategy over the OOS range with standard fees:
```bash
freqtrade backtesting \
  --config <config> \
  --strategy <Strategy>_Optimized \
  --timerange <out_sample_range> \
  --timeframe 5m \
  --pairs <selected_pairs> \
  --export trades \
  ...
```
Result is stored as `oos_result` and emitted. This is the primary OOS profit figure shown in the final report.

### Sub-step 3.2 — Slippage Stress Tests (1×, 2×, 3× fees)

For each fee multiplier in `[1.0, 2.0, 3.0]`, a temporary config with overridden `fee` is created via `_create_temp_config_with_fee_override()` and a backtest is run on the IS range. Results are stored per-pair:

```python
stress_results = {
    1.0: {"BTC/USDT": 0.042, "ETH/USDT": 0.031, ...},
    2.0: {"BTC/USDT": 0.038, ...},
    3.0: {"BTC/USDT": 0.029, ...},
}
```

Temp config files are deleted in a `finally` block regardless of outcome.

### Sub-step 3.3 — Stability Scores

For each pair:

```
profit_1x = stress_results[1.0][pair]
profit_3x = stress_results[3.0][pair]

if profit_1x <= 0:
    stability_score = 0.0
else:
    stability_score = clamp(100 * (profit_3x / profit_1x), 0, 100)
```

Interpretation: a score of 100 means the strategy retains all its profit when fees are tripled. A score of 60 means only 60% of IS profit survives 3× fees. Scores are stored in `state.stability_scores` and emitted as `stability_score_result` events per pair.

### Sub-step 3.4 — Winning-Pair Filter

Pairs with stability score = 0 (or below a threshold) are moved to `state.failing_pairs`. `state.winning_pairs` receives only the survivors.

### Sub-step 3.5 — Feature Injection

Two classes of features are injected into the `<Strategy>_Optimized.py` source:

#### Three-tier custom_stoploss

Injected immediately after the class definition line:

```python
def custom_stoploss(self, pair, trade, current_time, current_rate,
                    current_profit, after_fill, **kwargs) -> float | None:
    from freqtrade.strategy import stoploss_from_open
    if current_profit >= 0.08:
        return stoploss_from_open(0.03, current_profit, ...)  # lock at +3%
    if current_profit >= 0.04:
        return stoploss_from_open(0.015, current_profit, ...)  # lock at +1.5%
    if current_profit >= 0.02:
        return stoploss_from_open(0.005, current_profit, ...)  # lock at +0.5%
    return None
```

#### Trading-window class attributes

```python
blocked_hours = [14, 15, 3]   # UTC hours where strategy loses
blocked_days  = [5, 6]        # 5=Sat, 6=Sun (0-indexed Mon=0)
```

These are class-level constants. The strategy's `populate_entry_trend` is expected to read them to skip entries during excluded windows.

#### Stage 3 pass criteria

Stage 3 never fails on stress results alone — it passes as long as the OOS backtest and all three fee-multiplied backtests complete without subprocess errors. Feature injection failures are logged as warnings but do not halt the pipeline.

#### Stage 3 output shape

```json
{
  "stability_scores": {"BTC/USDT": 72.4, "ETH/USDT": 81.0, ...},
  "stress_results": {1.0: {...}, 2.0: {...}, 3.0: {...}},
  "excluded_time_windows": {"excluded_hours": [...], "excluded_days": [...]},
  "injection_success": true,
  "injection_error": null
}
```

---

## 7. Stage 4 — Portfolio Competition

**Entry point:** `_stage_joint_portfolio_backtest()` in `stages_assessment.py`  
*(Note: `_stage_risk_assessment()` also exists in the file for an earlier workflow variant; the active path in the orchestrator calls `_stage_joint_portfolio_backtest`.)*

This stage applies capital constraints to simulate how all selected pairs would compete in live trading when `max_open_trades` limits simultaneous positions.

### Sub-step 4.1 — Joint Portfolio Backtest

A temporary config with `max_open_trades` set to `state.max_open_trades` is written, then a backtest runs across all `selected_pairs` over the IS range:

```bash
freqtrade backtesting \
  --config <temp_config_max_open_trades> \
  --strategy <Strategy>_Optimized \
  --timerange <in_sample_range> \
  --pairs <selected_pairs> \
  --export trades \
  --export-filename <out_dir>/stage4_portfolio.json
```

### Sub-step 4.2 — Portfolio Metrics Extraction

`_extract_backtest_summary()` and `_extract_per_pair_results()` parse the JSON output. For each pair, `_extract_last_close_price()` is also called to get the current price for ATR normalisation.

### Sub-step 4.3 — Capital Starvation Detection

For each pair, the competition trade count is compared to the Stage 1 baseline:

```python
drop_pct = (baseline_trades - competition_trades) / baseline_trades
if drop_pct > 0.70:
    # CAPITAL STARVATION: this pair was crowded out
```

Starvation warnings are collected and included in the result payload but do **not** halt the stage.

### Sub-step 4.4 — Dual-Factor Sizing

For each pair in `per_pair`:

```python
target_risk_pct = 0.02          # 2% risk per trade
atr_pct = atr_value / current_price   # division-by-zero guarded; floor at 0.01

raw_weight = (target_risk_pct / atr_pct) * (stability_score / 100.0)
```

Then all `raw_weights` are summed and normalised:

```python
normalized_weight = raw_weight / sum(raw_weights)
```

If `sum(raw_weights) == 0` (all pairs have zero stability), equal weights are assigned as a fallback.

These weights are stored in `state.portfolio_weights` and injected as the `custom_stake_amount` method in Stage 5.

### Sub-step 4.5 — Non-Blocking Drawdown Gateway

If `portfolio_max_dd > state.max_drawdown_threshold`, a `portfolio_drawdown_warning` WebSocket event is emitted with the current and threshold values. The stage continues regardless.

### Sub-step 4.6 — Integrated Risk Assessment

Monte Carlo and profit-giveback are run on the portfolio trade list:

```python
mc_result = run_monte_carlo(profit_ratios, n=1000, threshold=state.monte_carlo_threshold)
profit_giveback = compute_profit_giveback_metrics(portfolio_trades_list)
```

#### Monte Carlo (`run_monte_carlo`)

- Shuffles the OOS profit-ratio series 1 000 times.
- Computes the maximum drawdown for each shuffle.
- Returns `p5_drawdown`, `p95_drawdown`, `median_final_return`, and equity-fan arrays (`p5`, `p50`, `p95`) for the equity-curve chart.
- **Pass condition:** `p95_drawdown < state.monte_carlo_threshold` (default 35%).

#### Profit Giveback (`compute_profit_giveback_metrics`)

Counts trades that:
1. Reached the tier-1 profit threshold (2%), AND
2. Closed with a negative profit.

`peak_to_loss_count > 0` **fails** the risk assessment gate in the `_stage_risk_assessment()` variant. In the portfolio variant it is reported but non-blocking.

#### Risk checks (hard gates)

| Check | Default threshold |
|---|---|
| `max_drawdown` | < 30% |
| `win_rate` | ≥ 40% |
| `profit_factor` | ≥ 1.0 |
| `sharpe_ratio` | ≥ 0.5 (0 = not computed, treated as pass) |
| Monte Carlo p95 DD | < 35% |

Any failing check terminates the pipeline at Stage 4.

#### Stage 4 output shape

```json
{
  "portfolio_metrics": {"profit_total_abs": ..., "max_drawdown_account": ..., "total_trades": ...},
  "per_pair_metrics": [...],
  "portfolio_weights": {"BTC/USDT": 0.35, "ETH/USDT": 0.28, ...},
  "monte_carlo": {
    "simulations": 1000,
    "p5_drawdown": 0.08,
    "p95_drawdown": 0.21,
    "median_final_return": 0.14,
    "passed": true,
    "equity_fan": {"p5": [...], "p50": [...], "p95": [...]}
  },
  "profit_giveback": {"peak_to_loss_count": 0, ...},
  "starvation_warnings": []
}
```

---

## 8. Stage 5 — Delivery

**Entry point:** `_stage_delivery()` in `stages_assessment.py`

This stage assembles and writes all output artefacts.

### 8.1 Optimised config.json

Reads the base `user_data/config.json` and injects:
- `minimal_roi` from `best_params["params_dict"]`
- `stoploss` from `best_params["params_dict"]`
- Trailing stop parameters if present in `params_dict`
- `exchange.pair_whitelist` set to the winning pairs

Written to `<out_dir>/config.json`.

### 8.2 Final strategy file injection

Six items are injected into `<Strategy>_Optimized.py` in order:

| Step | What is injected | Where |
|---|---|---|
| 1 | `atr_dict = {"BTC/USDT": 142.3, ...}` | After `INTERFACE_VERSION` line |
| 2 | `stability_dict = {"BTC/USDT": 72.4, ...}` | After `atr_dict` |
| 3 | `blocked_hours = [14, 3]` | After `stability_dict` |
| 4 | `blocked_days = [5, 6]` | After `blocked_hours` |
| 5 | `custom_stoploss()` | Already injected in Stage 3 |
| 6 | `custom_stake_amount()` | Appended before last line of class |

#### `custom_stake_amount` formula

```python
def custom_stake_amount(self, pair, current_time, current_rate,
                        proposed_stake, min_stake, max_stake,
                        leverage, entry_tag, side, **kwargs) -> float:
    target_risk_pct = 0.02
    atr = self.atr_dict.get(pair, current_rate * 0.02)   # 2% of price fallback
    atr_pct = atr / current_rate
    stability_score = self.stability_dict.get(pair, 50.0)
    position_size = proposed_stake * (target_risk_pct / atr_pct) * (stability_score / 100.0)
    position_size = max(exchange_min, min(exchange_max, position_size))
    return position_size
```

Guards:
- `atr <= 0 or current_rate <= 0` → return `min_stake`
- `position_size == 0` → return `min_stake`
- Clamped to `[min_stake, max_stake]`

### 8.3 OOS equity curve

Built by compounding per-trade profit ratios:

```python
equity = 1.0
for pr in oos_profit_ratios:
    equity *= 1.0 + pr
    oos_equity_curve.append(round(equity, 6))
```

The starting point (1.0×) is always included, even with zero trades.

### 8.4 report.json

A comprehensive JSON document written to `<out_dir>/report.json`. Top-level keys:

| Key | Content |
|---|---|
| `run_id`, `strategy`, `optimized_strategy` | Identifiers |
| `timeframe`, `in_sample_range`, `out_sample_range`, `exchange` | Run parameters |
| `created_at`, `completed_at` | ISO timestamps |
| `stages` | Array of `{index, name, status, message, data}` |
| `best_params` | Full hyperopt result including `params_dict` |
| `sanity_backtest` | Stage 1 summary |
| `oos_validation` | Stage 3 OOS backtest summary |
| `stress_test` | `{winning_pairs, failing_pairs, per_pair}` |
| `excluded_time_windows` | `{excluded_hours, excluded_days}` |
| `risk` | Stage 4 risk checks + metrics |
| `monte_carlo` | Full MC result including equity fan |
| `profit_giveback` | Peak-to-loss counts |
| `equity_curves.oos` | Array of compounded multipliers |
| `thresholds` | All active gates (max DD, win rate, PF, Sharpe, OOS profit, MC) |
| `files` | `{optimized_strategy, config, report}` — filenames for download |
| `ensemble_enabled`, `ensemble_weights` | Signal weights when ensemble mode is on |
| `sensitivity` | Final sensitivity check result |

### 8.5 Delivery WebSocket event

```json
{
  "type": "delivery_complete",
  "data": {
    "output_file_path": "/path/to/Strategy_Optimized.py",
    "passing_pairs_list": ["BTC/USDT", ...],
    "stability_scores": {"BTC/USDT": 72.4, ...},
    "atr_values": {"BTC/USDT": 142.3, ...}
  }
}
```

---

## 9. Cross-Cutting Concerns

### Subprocess management (`_run_subprocess`)

All freqtrade commands are run via `asyncio.create_subprocess_exec`. stdout and stderr are streamed line-by-line; each line is emitted over WebSocket in real time. Return code is inspected; non-zero codes are classified by `_classify_subprocess_error()` into human-readable error categories (out of memory, no trades, data missing, etc.).

### Cancellation

`_cancelled(run_id)` is polled at every subprocess boundary and between sub-steps. If `True`, a `_Cancelled` exception is raised, caught in the orchestrator's top-level `except _Cancelled` block, and the pipeline status is set to `"cancelled"`.

### Structured per-run logging (`_rlog`)

```python
_rlog(run_id, stage_index, logging.INFO, "message")
```

Writes a log line tagged with `run_id` and `stage` to a rotating file and also sends it to all WebSocket subscribers as a `log` event. Log level `DEBUG` lines are file-only by default.

### State persistence (`_save_state_to_disk`)

After every stage transition, `state` is serialised to `<out_dir>/state.json`. On backend restart, incomplete runs are detected (no `completed_at`, status was `running`) and promoted to `"interrupted"` status. The frontend displays an `InterruptedReport` in this case.

### Error classification (`_classify_subprocess_error`)

Parses freqtrade stdout/stderr for known patterns:

| Pattern | Reported as |
|---|---|
| `No trades` | "No trades generated — try adjusting parameters" |
| `not enough` data | "Insufficient historical data for the requested range" |
| OOM / `MemoryError` | "Out of memory — reduce epochs or pairs" |
| Non-zero RC, unknown | "freqtrade exited with code N — check logs" |

---

## 10. Frontend — AutoQuantTab.jsx

**File:** `frontend/src/components/AutoQuantTab.jsx`  
**Size:** ~3 500 lines  
**Dependencies:** React 18, recharts, DaisyUI (Tailwind)

### Component tree

```
AutoQuantTab (main)
├── ConfigForm                    ← Strategy/timerange/threshold inputs
├── StageStepper                  ← Live 5-stage progress indicator
├── LiveFitnessCurve              ← Recharts LineChart — per-epoch profit
├── CandidateLeaderboard          ← Top-N hyperopt epochs, expandable params
├── WfoWindowsTable               ← WFA window results table
├── TradeDistributionChart        ← Recharts BarChart — profit bucket histogram
├── LogTerminal                   ← Scrolling monospace log output (last 1000 lines)
├── FinalReport                   ← Shown on pipeline completion
│   ├── MetricCard × 4            ← IS profit, OOS profit, Max DD, Win Rate
│   ├── RobustnessBadge           ← Sensitivity result (Stable / Sharp Peak)
│   ├── RiskChecks                ← Grid of pass/fail check badges
│   ├── SignalStrengthViz         ← RSI/MACD/BB weight bars (ensemble mode)
│   ├── MonteCarloBadge           ← p5/p95 DD, median return, pass/fail
│   ├── EquityCurveChart          ← Composed chart: actual OOS + MC fan (p5–p95)
│   ├── PerPairProfitChart        ← Horizontal bar chart, sorted by profit
│   └── Download buttons          ← Strategy .py, config .json, report .html
├── FailureReport                 ← Shown on pipeline failure
│   └── GeneralizationFailurePanel ← Structured diagnostics for gen. failure
│       └── RetryHistoryTable     ← Per-attempt: loss fn, spaces, metrics, AI badge
└── InterruptedReport             ← Shown when backend restarted mid-run
```

### State management

All pipeline state lives in a single `useState` object called `runState`. It is initialised from an API poll (`GET /api/auto-quant/run/{runId}`) and then updated by WebSocket messages from `wss://{host}/api/auto-quant/ws/{runId}`.

Key `runState` fields mirrored from the backend:

| Field | Frontend use |
|---|---|
| `status` | Guards rendered panel (config / running / completed / failed) |
| `stages[]` | Powers `StageStepper` |
| `hyperopt_curve[]` | Fed to `LiveFitnessCurve` |
| `top_candidates[]` | Fed to `CandidateLeaderboard` |
| `wfo_windows[]` | Fed to `WfoWindowsTable` |
| `log_lines[]` | Fed to `LogTerminal` |
| `report` | Fed to `FinalReport` |
| `generalization_failure` | Fed to `FailureReport` |
| `sensitivity` | Fed to `RobustnessBadge` |

### WebSocket lifecycle

```javascript
function getWsUrl(runId) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  return `${proto}://${host}/api/auto-quant/ws/${runId}`;
}
```

The WebSocket is opened when a run starts and closed when:
- The server sends a `null` sentinel (all queues drained).
- The pipeline reaches a terminal state (`completed / failed / cancelled`).
- The component unmounts.

On each incoming message, status transitions are validated via `isValidStatusTransition()` before being applied to avoid out-of-order WebSocket messages corrupting the UI state.

### StageStepper component

Renders one row per stage. Visual states:

| Stage status | Background | Icon |
|---|---|---|
| `pending` | Faded, 60% opacity | Stage emoji (○ fallback) |
| `running` | `bg-primary/15`, animated "live" badge | Spinner |
| `passed` | `bg-success/8` | ✓ in green |
| `failed` | `bg-error/10` | ✗ in red with expandable error |

Live elapsed time (MM:SS) is computed from `stage.started_at` using a 1-second tick (`useEffect` + `setInterval`).

For passed stages, inline data badges show `P:` (profit), `DD:` (drawdown), and `T:` (trades) extracted from `stage.data`.

### LiveFitnessCurve component

- X axis: epoch number (from 1 to N)
- Y axis: profit in USDT (left), re-scaled per epoch
- Green line: `profit_usdt` per epoch
- Reference line at y=0
- Tooltip shows epoch, profit, objective score, trade count
- Best epoch highlighted with a summary badge above the chart
- Animation disabled (`isAnimationActive={false}`) for performance during live streaming

### CandidateLeaderboard component

Displays top-N hyperopt candidates in a 7-column grid: Rank · Epoch · Profit · Score · Drawdown · Win Rate · Trades. Clicking a row expands the parameter dict inline.

### EquityCurveChart component

Renders a `ComposedChart`:
- Green solid line: actual OOS equity (trade-by-trade multiplier starting at 1.0×)
- Amber shaded area: Monte Carlo p5–p95 fan (stacked `Area` components)
- Amber dashed line: Monte Carlo p50 median

The tooltip shows actual value, MC median, and fan range for the hovered trade.

Requires ≥ 5 trades to render; shows an empty-state message otherwise.

### MonteCarloBadge component

Shows:
- `p95 DD: X%` (the key pass/fail figure, in large bold text coloured green/red)
- `p5 DD: X%` and `Median return: X%` as secondary stats
- Pass/Fail badge
- Threshold label below

### RobustnessBadge component

Shows sensitivity check results:
- Stable Plateau vs. Sharp Peak icon
- Robustness score (High / Medium / Low)
- Parameter name that was tested
- Three profit values: best, −5%, +5%

### GeneralizationFailurePanel component

Activated when `failedStage.index === 2 or 4` and `generalization_failure` is set.

Two distinct failure modes:
1. **Sharp Peak** (`gf.reason === "sharp_peak"`): purple/secondary colour theme, mountain icon, suggestions about extending IS range or switching strategy.
2. **OOS Overfitting** (default): red/error theme, microscope icon, shows active profit and drawdown gates.

The `RetryHistoryTable` is collapsible. Each row includes an AI badge (with expandable reasoning) if an Ollama suggestion was used for that attempt.

**Retry with Relaxed Thresholds** button: only shown for OOS overfitting (not sharp peak). Pre-computes relaxed thresholds from the best attempt:
- `relaxed_oos_profit = best_attempt.profit - 0.01`
- `relaxed_max_dd = min(35, best_attempt.drawdown + 5)`

Calls `onRetryRelaxed(best_attempt, thresholds, best_attempt_strategy_name)` which sends a new `POST /api/auto-quant/run` with adjusted parameters.

### SignalStrengthViz component (ensemble mode)

Renders three horizontal progress bars for RSI, MACD, and BB signal weights. The bar width is the signal's share of total weight (`weight / total_weight * 100%`). Signals with `weight < 0.01` are shown as crossed-out. The consensus threshold is shown as a badge.

### LogTerminal component

- Maintains the last 1 000 log lines in the display buffer (older lines are sliced).
- Colour-codes lines: errors in red, successes in green, warnings in amber, neutral in grey.
- Supports a text filter (`filterLower`) applied client-side.
- Auto-scrolls to the bottom on each new log append via `bottomRef.current?.scrollIntoView()`.

### Download flow

Three download targets:

| Button | Endpoint | Filename |
|---|---|---|
| Download Optimized Strategy | `GET /api/auto-quant/download/{runId}/{filename}` | `<Strategy>_Optimized.py` |
| Download Config | `GET /api/auto-quant/download/{runId}/config.json` | `config.json` |
| Download Report | `GET /api/auto-quant/report/{runId}/html` | `report-{runId}.html` |

All use the programmatic `<a href>` click pattern (no `window.open` to avoid popup blockers).

### RunHistoryDashboard

Imported at the top of `AutoQuantTab.jsx`. Renders a separate panel listing all past run IDs with their status, strategy name, and summary metrics. Clicking a row populates `runId` and loads the historical state.

---

## 11. WebSocket Event Reference

All events are JSON objects. The server sends them from `_emit()`:

```python
_emit(run_id, stage_index, status, message, progress, data={}, msg_type="stage_update")
```

### Standard fields in every event

| Field | Type | Description |
|---|---|---|
| `type` | `str` | Event type (see below) |
| `stage` | `int` | Stage index (0 = global) |
| `status` | `str` | `running / passed / failed` |
| `message` | `str` | Human-readable progress message |
| `progress` | `int` | 0–100 (−1 = no change) |
| `data` | `dict` | Event-type-specific payload |

### Event types

| `type` | Emitted by | Key `data` fields |
|---|---|---|
| `stage_update` | All stages | — |
| `log` | `_rlog()` | `line` (log string), `level` |
| `hyperopt_epoch` | Stage 2 | `epoch`, `profit_usdt`, `objective`, `trades`, `drawdown_pct`, `win_rate_pct` |
| `hyperopt_top_candidates` | Stage 2 | `candidates[]` (top-N epochs with params) |
| `hyperopt_best_params` | Stage 2 | `params_dict`, `loss`, `epoch` |
| `wfo_window_result` | Stage 2 | `window`, `is_range`, `oos_range`, `profit`, `max_dd`, `trades`, `recency_weight`, `status` |
| `sensitivity_result` | Post Stage 2 | `sensitivity` dict with `passed`, `score`, `label`, `param`, `p_best`, `p_minus`, `p_plus` |
| `stability_score_result` | Stage 3 | `pair_name`, `stability_score`, `profit_1x`, `profit_2x`, `profit_3x` |
| `portfolio_backtest_result` | Stage 4 | `portfolio_metrics`, `per_pair_metrics`, `portfolio_weights`, `monte_carlo`, `profit_giveback` |
| `portfolio_drawdown_warning` | Stage 4 | `current_drawdown`, `threshold`, `exceeds_threshold` |
| `delivery_complete` | Stage 5 | `output_file_path`, `passing_pairs_list`, `stability_scores`, `atr_values` |

### Sentinel

When the pipeline reaches a terminal state, the server pushes `None` to every subscriber queue. The WebSocket handler sends a close frame; the frontend detects this and closes its WebSocket instance.

---

## 12. Configuration Reference

### user_data/config.json (base config)

Key fields consumed by the pipeline:

| Field | Example | Used by |
|---|---|---|
| `exchange.name` | `"binance"` | All stages |
| `exchange.pair_whitelist` | `["BTC/USDT", ...]` | Stage 1 pair universe |
| `stake_currency` | `"USDT"` | Stage 4 sizing |
| `stake_amount` | `100` | Stage 4 sizing |
| `max_open_trades` | `3` | Stage 4 capital constraint |
| `fee` | `0.001` | Stage 3 fee multiplier baseline |
| `timeframe` | `"5m"` | All stages |

### PipelineState thresholds (default values)

| Threshold | Default | Stage checked |
|---|---|---|
| `max_drawdown_threshold` | `0.30` (30%) | Stage 4 |
| `min_win_rate` | `0.40` (40%) | Stage 4 |
| `min_profit_factor` | `1.0` | Stage 4 |
| `min_sharpe` | `0.5` | Stage 4 |
| `min_oos_profit` | `0.0` | Stage 3 OOS |
| `monte_carlo_threshold` | `0.35` (35%) | Stage 4 |

All thresholds are surfaced in the `FinalReport` UI as "Active thresholds" badges and in the final `report.json`.

---

## 13. Failure Modes & Recovery

### Stage 1 failures

| Cause | UI message | Recovery |
|---|---|---|
| All pairs fail data healing | "No healthy pairs remain" | Add more data or extend download range |
| `< TOP_PAIRS_SELECTION_COUNT` profitable pairs | "Insufficient profitable pairs" | Adjust strategy parameters, widen IS range |
| freqtrade subprocess exits non-zero | Classified error message | Check backend logs |

### Stage 2 failures

| Cause | Recovery path |
|---|---|
| Sensitivity: `FAIL_NEGATIVE_BASELINE` | Hard Mutation retry (up to `max_retries`) |
| Sensitivity: Sharp Peak | Soft Mutation / Ollama-assisted retry |
| Retries exhausted | `generalization_failure` set; best attempt saved; suggestions shown in UI |
| freqtrade hyperopt OOM | Reduce epochs or pairs; restart run |

### Stage 3 failures

| Cause | Recovery |
|---|---|
| Subprocess error on any stress-test backtest | Stage 3 fails; pipeline halts |
| Feature injection error | Logged as warning; pipeline continues with unmodified strategy |

### Stage 4 failures

| Cause | Recovery |
|---|---|
| Any risk check fails (DD, win rate, PF, Sharpe) | Pipeline halts; UI shows which checks failed and their values |
| Monte Carlo p95 DD > threshold | Pipeline halts with MC failure message |
| Profit giveback detected | Pipeline halts (in `_stage_risk_assessment()` variant) |
| Capital starvation | Warning emitted; non-blocking |

### Stage 5 failures

Stage 5 is best-effort. Subprocess errors in the delivery stage are logged but do not corrupt output files already written. If ATR injection fails, the strategy is delivered without `custom_stake_amount`.

### Backend restart (interrupted runs)

On startup, the backend scans all `state.json` files. Any run with `status == "running"` and no `completed_at` is promoted to `"interrupted"`. The frontend detects this on the next poll and renders `InterruptedReport` with the last active stage and timestamp. The user must start a new run.

---

*End of documentation.*
