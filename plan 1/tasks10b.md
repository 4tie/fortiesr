# Task 10B: Portfolio Backtest on Top Ranked Pairs

## Goal
Create `run_portfolio_backtest()` — a standalone helper that takes the top-N ranked pairs from `run_individual_pair_sweep()` and runs a single joint portfolio backtest with capital constraints (max_open_trades). Backend metrics determine pass/fail; no AI judgement.

## Why This Comes Next
`run_individual_pair_sweep()` (Task 10A, existing in `pair_sweep_runner.py:526`) produces ranked per-pair results. The next logical step is to test those pairs **together** as a portfolio to see if they work under realistic capital constraints. Without this, you cannot tell if top-ranked pairs cannibalize each other or exceed drawdown limits when traded jointly.

## Existing Files to Reuse

| File | What to Reuse |
|------|---------------|
| `backend/services/execution/pair_sweep_runner.py:526` | `run_individual_pair_sweep()` — top-N output is input to portfolio helper |
| `backend/services/execution/backtest_runner.py` | `BacktestRunner.queue_strategy_backtest()` — async subprocess wrapper, already wired in AppServices |
| `backend/models/contracts.py` | `RunRequest` model — has `max_open_trades`, `pairs`, `timerange`, `timeframe`, `config_file`, `fee_rate`, `stake_amount`, `dry_run_wallet` |
| `backend/models/runs.py` | `ParsedSummary` — backtest result summary with `profit_factor`, `max_drawdown_pct`, `total_trades`, `win_rate_pct`, `sharpe_ratio` |
| `backend/services/auto_quant/pipeline_modules/config.py` | `MAX_DRAWDOWN_THRESHOLD`, `MIN_WIN_RATE`, `MIN_PROFIT_FACTOR`, `MIN_SHARPE`, `TOP_PAIRS_SELECTION_COUNT` |
| `backend/services/storage/result_parser.py` | `ResultParser.parse_summary()` — extracts `ParsedSummary` from backtest JSON |
| `backend/app_services.py` | Wires `BacktestRunner` as `self.backtest_runner` |

## Files Likely to Change

1. `backend/services/execution/pair_sweep_runner.py` — add `run_portfolio_backtest()` method
2. `backend/tests/test_pair_sweep_runner.py` (or new test file) — unit + integration tests

No frontend, no router, no pipeline file changes.

## Proposed Helper

**Function**: `PairSweepRunner.run_portfolio_backtest()`

**Location**: `backend/services/execution/pair_sweep_runner.py` (new method, ~80–120 lines)

## Inputs

```python
async def run_portfolio_backtest(
    self,
    pairs: list[str],            # top-N ranked pairs (already selected upstream)
    strategy_name: str,
    config_file: str,
    timerange: str,
    timeframe: str,
    max_open_trades: int = 5,    # capital constraint
    fee_rate: float = 0.001,
    dry_run_wallet: float = 1000.0,
    stake_amount: str | None = None,
) -> dict:
```

## Portfolio Backtest Flow

1. **Validate inputs** — reject empty `pairs`, zero/negative `max_open_trades`, empty `strategy_name`
2. **Build `RunRequest`** — set `pairs=pairs`, `max_open_trades=max_open_trades`, `fee_rate=fee_rate`, `dry_run_wallet=dry_run_wallet`, `stake_amount=stake_amount`
3. **Find strategy version** — call `self.registry.get_strategy(strategy_name)` then `self.version_manager.get_current_version(strategy_name)` to get `StrategyRecord` + `version_id`
4. **Run backtest** — call `self.backtest_runner.queue_strategy_backtest(strategy, version_id, request)` → returns `run_id`
5. **Wait for completion** — poll `self.run_repository.get_run(run_id)` until status is not `"running"` (simple loop with 1s sleep, max 600s)
6. **Load result** — `self.run_repository.load_parsed_result(run_id)` → `ParsedSummary`
7. **Extract per-pair metrics** — use `ResultParser._extract_per_pair_data(result_json)` from `result_parser.py` (if available) or load raw result JSON
8. **Return structured result dict** (see Return Shape below)

## `max_open_trades` Rules by Risk Profile

No risk profile system exists yet — use a simple lookup table inline:

| max_open_trades | When |
|-----------------|------|
| `1` | Conservative (high drawdown aversion) — tests pairs against each other fairly |
| `3` | Moderate (default for medium portfolios, 8–15 pairs) |
| `5` | Aggressive (default from pipeline `PipelineState.max_open_trades`) |
| `len(pairs)` | Full parallelism — only for small sets (≤5) |

Default: `5`. The caller can override. The helper **must not** select this value based on pair count or risk — the caller decides.

## Pass/Fail Rules

All metrics are checked deterministically against config thresholds (from `config.py` or defaults):

| Metric | Threshold | Source |
|--------|-----------|--------|
| `max_drawdown_pct` | ≤ 30% | `config.MAX_DRAWDOWN_THRESHOLD` |
| `win_rate_pct` | ≥ 40% | `config.MIN_WIN_RATE` |
| `profit_factor` | ≥ 1.0 | `config.MIN_PROFIT_FACTOR` |
| `sharpe_ratio` | ≥ 0.5 | `config.MIN_SHARPE` |
| `total_trades` | ≥ 10 | Hardcoded minimum |

All must pass → status `"passed"`. Any fail → `"failed"` with `failure_reasons: list[str]` naming which thresholds were breached.

## Return Shape

```python
{
    "status": str,                     # "passed" | "failed"
    "failure_reasons": list[str],      # empty if passed
    "run_id": str,
    "portfolio_summary": {
        "total_trades": int,
        "profit_factor": float | None,
        "win_rate_pct": float | None,
        "max_drawdown_pct": float | None,
        "sharpe_ratio": float | None,
        "profit_total_pct": float | None,
        "profit_total_abs": float | None,
    },
    "per_pair_metrics": [
        {
            "pair": str,
            "trades": int,
            "profit_factor": float | None,
            "win_rate_pct": float | None,
        }
    ],
    "config_used": {
        "pairs_count": int,
        "max_open_trades": int,
        "timerange": str,
        "timeframe": str,
    },
}
```

## Tests Needed

1. **Unit: pass case** — mock `registry`, `version_manager`, `backtest_runner`, `run_repository` to return a `ParsedSummary` above all thresholds; assert `status == "passed"` and `failure_reasons` is empty
2. **Unit: fail case (drawdown)** — mock a result where `max_drawdown_pct = 0.45`; assert `status == "failed"` and `"max_drawdown_pct"` in failure reason
3. **Unit: fail case (low trades)** — mock `total_trades = 3`; assert failure
4. **Unit: empty pairs** — assert `ValueError` raised
5. **Integration (optional)** — run against `BacktestRunner` with a real strategy stub and 2–3 known pairs to verify the flow doesn't crash. Use a short timerange. Mark as `@pytest.mark.slow`.

## What Not to Touch

- Do not modify `BacktestRunner` or create a new subprocess runner
- Do not select/filter pairs inside this helper — pairs are given
- Do not write to `PairSelectorService` yet
- Do not perform OOS/WFO — single timerange only
- Do not invoke AI (Ollama) — metrics-only pass/fail
- Do not modify any AutoQuant pipeline stages
- Do not modify frontend, routers, or models
- Do not add Monte Carlo, sensitivity, profit giveback, or capital starvation detection — those belong in the pipeline stages

## First Implementation Task Only

1. Add `run_portfolio_backtest()` method to `PairSweepRunner` in `pair_sweep_runner.py`
2. Write unit tests for pass/fail/edge cases
3. Run `pytest backend/tests/test_pair_sweep_runner.py -xvs` to verify
