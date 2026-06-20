# tasks6.md — Backtest Gate

## 1. Goal

Create a backend helper that takes a safe working strategy file (from Task 5), validates market data quality, runs a single controlled Freqtrade backtest using existing `BacktestRunner`, extracts key metrics from the parsed result, and returns a structured pass/fail verdict based on backend thresholds only (no AI judgement).

## 2. Why this task comes next

Tasks 3–5 produce rendered, validated, disk-safe strategy files. Task 4 already gates data quality. Task 6 closes the loop: it actually runs Freqtrade against the saved working copy and reports whether the strategy meets minimum viability thresholds. Without this, there is no deterministic signal that a new strategy is worth further optimization or comparison.

## 3. Existing files to reuse

| File | What it provides |
|------|-----------------|
| `backend/services/execution/backtest_runner.py` | `BacktestRunner._execute_run()`, `_execute_sync()`, `_build_command()` — synchronous subprocess lifecycle. Add a minimal public entry point for raw strategy sources. |
| `backend/services/execution/data_quality_gate.py` | `check_data_quality()` — pre-flight data validation gate |
| `backend/services/storage/result_parser.py` | `ResultParser.parse_run_artifacts()` — parses `raw_result.json` into `ParsedSummary` with profit_factor, sharpe_ratio, max_drawdown_pct, total_trades, win_rate_pct, expectancy |
| `backend/services/storage/run_repository.py` | `RunRepository` — run dir resolution, metadata load/save |
| `backend/models/runs.py` | `ParsedSummary`, `RunMetadata` — structured backtest result models |
| `backend/models/contracts.py` | `RunRequest` — backtest config shape (reuse fields) |
| `backend/utils.py` | `atomic_write_text()`, `build_run_id()`, `utc_now()` |
| `backend/paths.py` | `build_local_paths()` — path resolution |

## 4. Files likely to change

| File | Change |
|------|--------|
| `backend/services/execution/backtest_gate.py` | **New** — standalone `run_backtest_gate()` helper |
| `backend/services/execution/backtest_runner.py` | Add one public method `run_raw_backtest()` that accepts a `strategy_source: str` directly (bypasses version manager, reuses everything else). Minimal additive change. |
| `backend/tests/test_backtest_gate.py` | **New** — tests for the gate function |
| `backend/tests/test_backtest_runner_raw.py` | **New** — tests for `run_raw_backtest()` |

## 5. Proposed helper function name and location

**Location:** `backend/services/execution/backtest_gate.py`

**Function:**
```python
def run_backtest_gate(
    *,
    strategy_path: str,            # Path to the safe working .py file (Task 5 output)
    strategy_source: str,          # Source code of the strategy (read from strategy_path)
    strategy_name: str,            # Strategy class name
    config_file: str,              # Freqtrade config path
    timerange: str,                # e.g. "20240101-20240131"
    timeframe: str,                # e.g. "5m"
    pairs: list[str],             # e.g. ["BTC/USDT", "ETH/USDT"]
    max_open_trades: int = 1,
    dry_run_wallet: float = 1000.0,
    user_data_dir: str,
    exchange: str = "binance",
    backtest_runner: BacktestRunner,
) -> BacktestGateResult:
```

## 6. Inputs needed

```
strategy_path     — absolute path to the safe working .py file (from save_rendered_strategy)
strategy_source   — file contents, pre-read by caller
strategy_name     — class name inside the source (for --strategy flag)
config_file       — Freqtrade config JSON path
timerange         — e.g. "20240101-20240131"
timeframe         — e.g. "5m", "1h"
pairs             — list of trading pairs
max_open_trades   — int, default 1
dry_run_wallet    — float, default 1000.0
user_data_dir     — resolved user_data path
exchange          — exchange name (default "binance")
```

## 7. Backtest flow steps

1. **Data quality gate** — call `check_data_quality(pairs, timeframe, timerange, user_data_dir, exchange)`. If `passed` is False, return early with `gate_status="data_quality_failed"` and the error list.
2. **Run backtest** — call `backtest_runner.run_raw_backtest(strategy_source=strategy_source, strategy_name=strategy_name, ...)`. This writes the source to a fresh run directory, builds the Freqtrade command, launches the subprocess, and parses the result.
3. **Read parsed result** — after `run_raw_backtest` returns the `run_id`, read `ParsedSummary` from `run_dir / "parsed_summary.json"`.
4. **Extract gate metrics** — pull the 6 metrics listed in §8 from the summary.
5. **Apply pass/fail rules** (§9).
6. **Return** structured `BacktestGateResult`.

## 8. Metrics to extract

Exactly 6 metrics from `ParsedSummary`:

| # | Metric | ParsedSummary field | Why |
|---|--------|-------------------|-----|
| 1 | Total trades | `total_trades` | Strategy must actually trade |
| 2 | Win rate | `win_rate_pct` | Minimum batting average |
| 3 | Profit factor | `profit_factor` | Risk/reward efficiency |
| 4 | Max drawdown | `max_drawdown_pct` | Capital preservation |
| 5 | Expectancy | `expectancy` | Per-trade expected value in currency |
| 6 | Sharpe ratio | `sharpe_ratio` | Risk-adjusted return |

No custom recalculation. These come directly from `ParsedSummary`. If a metric is `None`, treat it as a pass-skip (not a failure), but include a note in `warnings`.

## 9. Pass/fail rules

All rules are backend-deterministic. No AI threshold adjustment.

| Rule | Condition | Failure code |
|------|-----------|-------------|
| Minimum trades | `total_trades >= 10` | `MIN_TRADES` |
| Minimum win rate | `win_rate_pct >= 40.0` | `MIN_WIN_RATE` |
| Minimum profit factor | `profit_factor >= 1.05` | `MIN_PROFIT_FACTOR` |
| Maximum drawdown | `max_drawdown_pct <= 30.0` | `MAX_DRAWDOWN` |
| Positive expectancy | `expectancy > 0` | `POSITIVE_EXPECTANCY` |
| Minimum sharpe | `sharpe_ratio >= 0.5` | `MIN_SHARPE` |

Pass = all 6 rules pass. Fail = any rule fails. Failing rules are listed in the result.

Thresholds are sensible defaults but should be defined as module-level constants so they can be tuned later without changing logic:

```python
GATE_THRESHOLDS = {
    "min_trades": 10,
    "min_win_rate_pct": 40.0,
    "min_profit_factor": 1.05,
    "max_drawdown_pct": 30.0,
    "positive_expectancy": True,
    "min_sharpe_ratio": 0.5,
}
```

## 10. Return shape

```python
@dataclass
class BacktestGateResult:
    gate_status: Literal["passed", "failed", "data_quality_failed", "backtest_failed"]
    run_id: str | None                 # backtest run id, if executed
    metrics: dict[str, float | None]  # the 6 extracted metrics
    failures: list[str]               # failure codes, empty on pass
    errors: list[str]                 # system errors (data quality, backtest crash)
    warnings: list[str]               # skipped metrics, non-critical notes
    details: dict | None              # data quality details, if checked
```

Gate status:
- `data_quality_failed` — data quality check rejected input
- `backtest_failed` — backtest crashed or produced no result
- `failed` — backtest completed but failed pass/fail rules
- `passed` — all gates and rules passed

## 11. Tests needed

Create `backend/tests/test_backtest_gate.py`:

| Test | What it covers |
|------|---------------|
| `test_gate_data_quality_fails_early` | Missing data returns `data_quality_failed` without running backtest |
| `test_gate_passes_all_thresholds` | Mock a `ParsedSummary` with good metrics → gate passes |
| `test_gate_fails_min_trades` | `total_trades=3` → `MIN_TRADES` failure |
| `test_gate_fails_win_rate` | `win_rate_pct=25.0` → `MIN_WIN_RATE` failure |
| `test_gate_fails_profit_factor` | `profit_factor=1.01` → `MIN_PROFIT_FACTOR` failure |
| `test_gate_fails_drawdown` | `max_drawdown_pct=45.0` → `MAX_DRAWDOWN` failure |
| `test_gate_fails_expectancy` | `expectancy=-5.0` → `POSITIVE_EXPECTANCY` failure |
| `test_gate_fails_sharpe` | `sharpe_ratio=0.1` → `MIN_SHARPE` failure |
| `test_gate_reports_multiple_failures` | Several thresholds fail simultaneously — all reported |
| `test_gate_skips_none_metrics` | `sharpe_ratio=None` → skip check, include warning |

Create `backend/tests/test_backtest_runner_raw.py`:

| Test | What it covers |
|------|---------------|
| `test_run_raw_backtest_writes_source` | `run_raw_backtest` writes strategy_source to run_dir |
| `test_run_raw_backtest_skips_version_manager` | No version manager calls are made |
| `test_run_raw_backtest_returns_run_id` | Valid run_id returned on success |

Run:
`.venv/bin/pytest backend/tests/test_backtest_gate.py backend/tests/test_backtest_runner_raw.py -xvs`

## 12. What not to touch

- Do not modify frontend.
- Do not create API endpoints (gate is backend-only for now).
- Do not modify pipeline files (`backend/services/auto_quant/pipeline_modules/`).
- Do not modify `data_quality_gate.py` (reuse as-is).
- Do not modify `result_parser.py` (parse shape unchanged).
- Do not modify `strategy_code_writer.py` (consumer of its output, not modifier).
- Do not modify `SaveResult` or any Task 5 contracts.
- Do not run hyperopt.
- Do not perform OOS/WFO.
- Do not let AI judge results — backend thresholds decide.
- Do not modify `SettingsModel` (gate config is function parameters, not settings).

## 13. First implementation task only

1. Add `run_raw_backtest()` to `BacktestRunner` that:
   - Accepts `strategy_source: str` instead of relying on version manager
   - Writes source to `run_dir / "strategy_snapshot.py"`
   - Calls `_execute_sync()` with the built command
   - Returns `run_id`
2. Create `backend/services/execution/backtest_gate.py` with:
   - Module-level `GATE_THRESHOLDS` dict
   - `BacktestGateResult` dataclass
   - `run_backtest_gate()` function implementing the 6-step flow from §7
   - `_apply_gate_rules(metrics) -> list[str]` private helper
3. Write both test files from §11.
4. Run: `.venv/bin/pytest backend/tests/test_backtest_gate.py backend/tests/test_backtest_runner_raw.py -xvs`
