# Backtesting and Hyperopt — How Evaluation Works

Backtesting means: run your strategy on **real old data** and see if it would have made money.

Hyperopt means: run many backtests with different parameters and pick the best ones.

Both use the same engine. Hyperopt is just backtesting, repeated many times.

---

## Required: Market Data

Before backtesting or hyperopting, you need historical OHLCV data.

```bash
# Download 30 days of 1m and 5m data for all pairs in config
freqtrade download-data --exchange binance

# Specific pairs
freqtrade download-data --exchange binance --pairs BTC/USDT ETH/USDT

# Specific timerange
freqtrade download-data --exchange binance --timerange 20230101-
```

Data format: `feather` by default. Alternatives: `json`, `jsongz`, `parquet`.

Storage path: `user_data/data/<exchange>/<pair>-<timeframe>.feather`

---

## Running a Backtest

```bash
freqtrade backtesting --strategy MyStrategy -i 5m
freqtrade backtesting --strategy MyStrategy -i 1m --timerange 20240101-20240601
freqtrade backtesting --strategy MyStrategy --dry-run-wallet 1000 -p BTC/USDT ETH/USDT
```

Output breakdown:
- **Trades** — total number of trades
- **Avg Profit %** — average per-trade profit
- **Tot Profit %** — total profit across all trades
- **Win Rate** — wins / total trades
- **Drawdown %** — max peak-to-trough equity loss
- **Avg Duration** — how long positions are held

---

## Key Backtest Assumptions

Backtesting is **not** reality. It makes assumptions that can inflate results:

1. **All orders fill** — even limit orders without exchange volume.
2. **Entry happens at next candle open** — ignores real execution delay.
3. **No slippage beyond fees** — assumes ideal fills.
4. **One trade per pair at a time** — by default, no stacking.
5. **Pairlist is static** — dynamic pairlists can introduce lookahead bias.
6. **Fees use exchange defaults** — real fees vary by tier, BNB rebates, etc.

If backtest looks amazing but dry-run is weak — check these assumptions first.

---

## Slippage and Execution Delay

Backtest entries happen on next candle open after signal. In live there is:
- Network latency
- Processing time to analyze data
- Order-matching delay

Result: real entry price may differ from backtest entry price. More pairs or slower hardware = more delay = worse results.

---

## Timeframe Detail

```bash
freqtrade backtesting --strategy MyStrategy --timeframe-detail 1m
```

This simulates entries/exits at 1-minute granularity instead of the main timeframe. It is much slower, but more accurate when multiple pairs signal on the same candle.

Without `--timeframe-detail`, only the first `max_open_trades` signals per candle are evaluated.

---

## Exporting and Comparing Results

```bash
# Export trades to JSON
freqtrade backtesting --strategy MyStrategy --export trades

# Export to a custom directory
freqtrade backtesting --strategy MyStrategy --backtest-directory user_data/backtest_results/my_run/

# Show breakdown by weekday
freqtrade backtesting --strategy MyStrategy --breakdown weekday
```

Compare multiple strategies:
```bash
freqtrade backtesting --strategy-list S1 S2 -i 5m --export trades
```

---

## Hyperopt — Parameter Optimization

Hyperopt runs backtesting many times with different parameters and finds combinations that minimize a **loss function**.

```bash
freqtrade hyperopt -s MyStrategy -i 5m --epochs 100 -j 2
freqtrade hyperopt -s MyStrategy -i 5m --spaces buy sell roi stoploss --epochs 200
```

### Spaces

- `default` — buy, sell, roi, stoploss (no trailing, no protections)
- `buy`, `sell` — signal thresholds
- `enter`, `exit` — alternative naming for entry/exit params
- `roi` — take-profit table
- `stoploss` — stoploss value
- `trailing` — trailing stop params
- `protection` — protection rules
- `all` — all of the above

Only parameters defined with `IntParameter`, `DecimalParameter`, etc. can be hyperopted.

### Epochs and Jobs

- `-e INT` — number of parameter combinations to test (default: 100)
- `-j INT` — parallel workers. `-j -1` = all CPUs. `-j 1` = single core.

More epochs = better search, but slower.
More jobs = faster, but CPU-heavy.

### Loss Functions

Built-in loss functions (use `--hyperopt-loss NAME`):

| Loss function | What it optimizes |
|---------------|-------------------|
| `ShortTradeDurHyperOptLoss` | Short trades (avoids very long holds) |
| `OnlyProfitHyperOptLoss` | Pure profit |
| `SharpeHyperOptLoss` | Risk-adjusted returns |
| `SharpeHyperOptLossDaily` | Daily Sharpe ratio |
| `SortinoHyperOptLoss` | Downside risk-adjusted |
| `MaxDrawDownHyperOptLoss` | Minimum drawdown |
| `MaxDrawDownRelativeHyperOptLoss` | Relative drawdown |
| `ProfitDrawDownHyperOptLoss` | Profit vs drawdown tradeoff |
| `MultiMetricHyperOptLoss` | Multiple metrics combined |

Choose based on your actual goal:
- Income with controlled risk → `MaxDrawDown...` or `ProfitDrawDown...`
- Risk-adjusted robot → `SharpeHyperOptLoss`

### Minimum Trades

```bash
freqtrade hyperopt -s MyStrategy --min-trades 10
```

Forces hyperopt to ignore parameter sets that produce fewer than 10 trades. A strategy with 2 lucky wins is not useful.

### Reproducible Results

```bash
freqtrade hyperopt -s MyStrategy --random-state 42
```

Locks the random search seed so results can be repeated.

---

## After Hyperopt

1. Copy the best parameters into your strategy.
2. Run backtesting again with the same timerange/fee/pairs to confirm the numbers match.
3. If they do NOT match: check for config overrides, missing parameters JSON, strategy vs config stoploss/ROI conflicts.

Common mismatch causes:
- Parameters defined in `populate_indicators()` instead of entry/exit — calculated once per epoch instead of per evaluation.
- Config file overriding strategy values for `stoploss`, `max_open_trades`, `trailing_stop`.
- Missing or outdated `params.json` file in strategy directory.

```bash
freqtrade hyperopt-list   # list all saved hyperopt results
freqtrade hyperopt-show   # show details of a specific result
```

---

## What Backtesting Cannot Tell You

- Real execution delays
- Real order fills and slippage
- Real fee structures
- Future market regime changes
- Whether the strategy will generalize across pairs/time

That is why dry-run is mandatory before live.

---

## Recommended Testing Pipeline

```
download data
    ↓
backtest
    ↓
lookahead-analysis + recursive-analysis
    ↓
hyperopt
    ↓
backtest with optimized params
    ↓
dry-run on real-time data
    ↓
only then consider live
```

Sources:
- https://www.freqtrade.io/en/stable/backtesting/
- https://www.freqtrade.io/en/stable/hyperopt/
- https://www.freqtrade.io/en/stable/data-download/
