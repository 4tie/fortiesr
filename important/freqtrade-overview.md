# Freqtrade — What It Is

Freqtrade is a free, open-source **crypto trading bot** written in Python.

It focuses on spot and futures crypto markets and is built around one idea: separate **strategy logic** from **market operations**.

- Supported exchanges: Binance, Kraken, Bybit, OKX, Gate.io, Bitget, BingX, HTX, and more via CCXT.
- Modes: backtest, dry-run, live.
- Interfaces: built-in Web UI, Telegram, REST API.

---

## Words Freqtrade Uses

| Term | Simple meaning |
|------|----------------|
| Strategy | The Python rules that say when to buy and sell |
| Trade | An open position on the exchange |
| Pair | What you trade, e.g. `BTC/USDT` |
| Timeframe | One candle length, e.g. `5m`, `1h` |
| OHLCV | Open, High, Low, Close, Volume of a candle |
| Indicator | Calculated value from OHLCV data, e.g. RSI, EMA |
| Entry signal | "Buy now" flag |
| Exit signal | "Sell now" flag |
| Stoploss | Automatic sell if loss goes too deep |
| ROI | Take-profit levels based on profit % over time |
| Pairlist | The list of pairs the bot is allowed to trade |
| Hyperopt | Automatic search for best strategy parameters |
| Backtest | Test the strategy on old data without real money |
| Dry-run | Simulate live trading with fake money |
| Live | Real money on the exchange |
| Slot | One open trade position |

---

## What It Actually Does

1. You write a strategy in Python.
2. You download historical candle data.
3. You backtest the strategy against that data.
4. You optionally run Hyperopt to find better parameters.
5. You run the bot in **dry-run** to see how it behaves in live-like conditions.
6. Only after proven results: you switch to **live** with real money.

---

## Bot Execution Loop

When running live or dry-run, freqtrade repeats this loop every few seconds:

- Fetch open trades and current data
- For each pair: calculate indicators, check entry/exit signals
- Check if existing trades should be closed (stoploss, ROI, exit signal, custom_exit)
- Check if we can open new trades (available slots, balance, pair allowed)

---

## Backtesting / Hyperopt Logic

These are different from live mode:

- The entire time range is loaded once.
- `populate_indicators()` runs once per pair.
- `populate_entry_trend()` and `populate_exit_trend()` run once per pair.
- Then the engine simulates candle-by-candle trade execution.
- Fees are included by default — all profit calculations use exchange default fees.

---

## Fees

- All profit numbers already include fees: entry fee + exit fee.
- In backtest/hyperopt: uses exchange default fee.
- In live: uses the actual fee applied by the exchange.

This means if a strategy shows +10% net profit, that is already after fees.

---

## Exchange & Pair Naming

- Spot: `BTC/USDT`, `ETH/BTC`
- Futures: `ETH/USDT:USDT` (note the `:settle` suffix)

Wrong naming = pair not recognized = bot cannot trade it.

---

## Configuration

Stored in `config.json` or another file passed via `-c`.

Mandatory fields:
- `exchange` — name + API key/secret (only required for live trading)
- `stake_currency` — the currency used for trading (e.g. `USDT`)
- `stake_amount` — amount per trade, or `"unlimited"` for dynamic sizing
- `dry_run` — `true` for simulated trading
- `max_open_trades` — max concurrent trade slots
- `pairlists` — which pairs to consider

Environment variables override config values. Prefix: `FREQTRADE__`.

Multiple config files can be loaded and merged.

---

## Data Storage

- OHLCV data: `user_data/data/<exchange>/<pair>-<timeframe>.<format>`
- Trade database: SQLite by default, stores trades during live/dry-run
- Backtest results: `user_data/backtest_results/`
- Strategies: `user_data/strategies/`
- Hyperopt results: stored and viewable via `hyperopt-list` / `hyperopt-show`

Data formats for OHLCV: `feather` (default), `json`, `jsongz`, `parquet`.

---

## Version Notes

- Strategy interface version: `3` is current.
- Strategies can be controlled via Web UI (FreqUI), Telegram, REST API, or webhooks.
- Plugins extend behavior: pairlists, protections, order types, etc.

---

Sources:
- https://www.freqtrade.io/en/stable/bot-basics/
- https://www.freqtrade.io/en/stable/configuration/
- https://www.freqtrade.io/en/stable/backtesting/
- https://www.freqtrade.io/en/stable/strategy-101/
- https://www.freqtrade.io/en/stable/install/
