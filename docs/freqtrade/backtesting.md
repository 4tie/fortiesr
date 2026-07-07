# Backtesting

Backtesting allows you to test your trading strategy against historical data to evaluate its performance before risking real money.

## Test your strategy with Backtesting

Now you have good entry and exit strategies and some historic data, you want to test it against real data. This is what we call backtesting.

Backtesting will use the crypto-currencies (pairs) from your config file and load historical candle (OHLCV) data from `user_data/data/<exchange>` by default. If no data is available for the exchange / pair / timeframe combination, backtesting will ask you to download them first using `freqtrade download-data`. For details on downloading, please refer to the Data Downloading section in the documentation.

### Using dynamic pairlists for backtesting

Using dynamic pairlists is possible (not all of the handlers are allowed to be used in backtest mode), however it relies on the current market conditions - which will not reflect the historic status of the pairlist. Also, when using pairlists other than StaticPairlist, reproducibility of backtesting-results cannot be guaranteed. Please read the pairlists documentation for more information.

To achieve reproducible results, best generate a pairlist via the `test-pairlist` command and use that as static pairlist.

**Note**: By default, Freqtrade will export backtesting results to `user_data/backtest_results`. The exported trades can be used for further analysis or can be used by the plotting sub-command (`freqtrade plot-dataframe`) in the scripts directory.

### Starting balance

The starting balance for backtesting can be set using the `dry_run_wallet` parameter in your configuration.

### Dynamic stake amount

You can use dynamic stake amounts in backtesting by setting `stake_amount` to "unlimited".

### Example backtesting commands

```bash
# Basic backtesting
freqtrade backtesting --strategy MyStrategy

# Backtesting with specific timerange
freqtrade backtesting --strategy MyStrategy --timerange 20240101-20240630

# Backtesting with multiple strategies
freqtrade backtesting --strategy-list MyStrategy1 MyStrategy2

# Backtesting with specific pairs
freqtrade backtesting --strategy MyStrategy --pairs BTC/USDT ETH/USDT

# Backtesting with detailed output
freqtrade backtesting --strategy MyStrategy --breakdown month
```

## Understand the backtesting result

### Backtesting report table

The backtesting report table shows the overall performance of your strategy across all tested pairs.

### Left open trades table

The left open trades table shows trades that were still open at the end of the backtesting period.

### Enter tag stats table

The enter tag stats table shows statistics for trades based on their entry tags.

### Exit reason stats table

The exit reason stats table shows statistics for trades based on their exit reasons.

### Mixed tag stats table

The mixed tag stats table shows statistics for trades based on both entry and exit tags.

### Summary metrics

The summary metrics provide key performance indicators for your strategy:

- **Total Profit**: Total profit/loss across all trades
- **Total ROI**: Return on investment percentage
- **Total Trades**: Total number of trades executed
- **Winning Trades**: Number of profitable trades
- **Losing Trades**: Number of unprofitable trades
- **Avg. Profit**: Average profit per trade
- **Avg. Duration**: Average duration of trades
- **Max Drawdown**: Maximum drawdown experienced
- **Sharpe Ratio**: Risk-adjusted return metric

### Daily / Weekly / Monthly / Yearly breakdown

You can view performance breakdowns by different time periods using the `--breakdown` parameter:

```bash
freqtrade backtesting --strategy MyStrategy --breakdown day
freqtrade backtesting --strategy MyStrategy --breakdown week
freqtrade backtesting --strategy MyStrategy --breakdown month
freqtrade backtesting --strategy MyStrategy --breakdown year
```

### Backtest result caching

Freqtrade caches backtesting results to speed up subsequent runs. You can clear the cache if needed.

### Further backtest-result analysis

You can use the exported backtesting results for further analysis using tools like:

- `freqtrade plot-dataframe` - Visualize trades on charts
- `freqtrade plot-profit` - Plot profit over time
- Custom analysis scripts using the exported CSV files

### Backtest output file

Backtesting results are exported to `user_data/backtest_results/backtest-result.json` by default. This file contains detailed information about all trades executed during backtesting.

## Assumptions made by backtesting

Backtesting makes several assumptions that may not reflect real trading conditions:

- Orders are filled at the exact price specified
- No slippage is considered (unless configured)
- Fees are calculated based on exchange default fees
- Market conditions are assumed to be similar to historical data

### Trading limits in backtesting

Backtesting respects the trading limits set in your configuration, such as:
- `max_open_trades`
- `stake_amount`
- `tradable_balance_ratio`

## Improved backtest accuracy

To improve backtesting accuracy:

1. Use realistic fee settings
2. Consider slippage in your strategy
3. Use sufficient historical data
4. Test across different market conditions
5. Avoid overfitting to historical data

## Backtesting multiple strategies

You can backtest multiple strategies at once to compare their performance:

```bash
freqtrade backtesting --strategy-list Strategy1 Strategy2 Strategy3
```

This will run all strategies and produce a comparison report.

## Next step

[Hyperopt](https://docs.freqtrade.io/en/latest/hyperopt/) - Optimize your strategy parameters using hyperparameter optimization.
