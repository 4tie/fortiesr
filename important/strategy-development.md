# Strategy Development — How It Works

A strategy is a Python class that inherits from `IStrategy`.

It returns:
- **Entry signal** (`enter_long`) — when to buy
- **Exit signal** (`exit_long`) — when to sell

It also defines:
- **stoploss** — max accepted loss before forced exit
- **minimal_roi** — profit levels that automatically close trades
- **timeframe** — candle size, e.g. `5m`, `1h`

---

## Minimal Strategy Structure

```python
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class MyStrategy(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "5m"
    stoploss = -0.10          # -10% stoploss
    minimal_roi = {"0": 0.01} # exit when profit > 1%

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[dataframe["rsi"] < 30, "enter_long"] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[dataframe["rsi"] > 70, "exit_long"] = 1
        return dataframe
```

---

## How Data Flows

1. Freqtrade loads candle data for every pair.
2. `populate_indicators()` — all TA indicators are added to the dataframe.
3. `populate_entry_trend()` — creates `enter_long` column with `1` where entry is wanted.
4. `populate_exit_trend()` — creates `exit_long` column with `1` where exit is wanted.
5. The bot uses these columns to simulate or execute trades.

---

## Important Pandas Rules

- Use vectorized operations, NOT loops or `.iloc[-1]` in populate functions.
- Use `df['col'].rolling(window).mean()` instead of `df['col'].mean()`.
- Always return the full dataframe without removing OHLCV columns.

Wrong:
```python
if dataframe['rsi'] > 30:  # ERROR
    dataframe['enter_long'] = 1
```

Right:
```python
dataframe.loc[dataframe['rsi'] > 30, 'enter_long'] = 1
```

---

## Strategy Modes

A strategy can run in 5 modes:
1. **Backtesting** — simulated on historical data
2. **Hyperopt** — automatic parameter search using backtests
3. **Dry run** — simulated live trading with fake money
4. **Live** — real money on the exchange
5. **FreqAI** — ML-enhanced strategy with automatic retraining

Always test with dry-run before live. Never start with live.

---

## Callbacks — When You Need Custom Logic

The main methods (`populate_*`) are vectorized. For per-trade logic, use callbacks:

- `custom_stoploss()` — dynamic stoploss per trade
- `custom_exit()` — custom exit condition per trade
- `custom_roi()` — custom take-profit per trade
- `custom_entry_price()` / `custom_exit_price()` — custom order prices
- `custom_stake_amount()` — dynamic position sizing
- `confirm_trade_entry()` / `confirm_trade_exit()` — approve or reject trades
- `leverage()` — define leverage for futures
- `adjust_trade_position()` — add to existing position
- `bot_start()` / `bot_loop_start()` — one-time or per-iteration setup
- `order_filled()` — called when an order fills

---

## Hyperopt Parameters — Built-in Types

You can define hyper-optimizable parameters directly in the strategy:

```python
buy_ma_count = IntParameter(1, 20, default=10, space="buy")
buy_rsi_threshold = DecimalParameter(20, 40, default=28, space="buy")
buy_enabled = BooleanParameter(default=True, space="buy")
buy_method = CategoricalParameter(["ema", "sma", "wma"], default="ema", space="buy")
```

Available types: `IntParameter`, `DecimalParameter`, `BooleanParameter`, `CategoricalParameter`, `RealParameter`.

---

## Generating a Strategy Template

```bash
freqtrade new-strategy --strategy AwesomeStrategy
# Non-empty template
freqtrade new-strategy --strategy AwesomeStrategy --template advanced
# Minimal
freqtrade new-strategy --strategy AwesomeStrategy --template minimal
```

Output file: `user_data/strategies/AwesomeStrategy.py`

---

## Looking Ahead / Bias Checks

Before running live, always check:
- `freqtrade lookahead-analysis` — finds lookahead bias from future data
- `freqtrade recursive-analysis` — finds recursive indicator issues

These are hard requirements, not optional.

---

## Inspecting Your Strategy

```bash
freqtrade show-config           # merged final config
freqtrade strategies            # list available strategies
freqtrade strategy --strategy MyStrategy  # strategy details
```

Sources:
- https://www.freqtrade.io/en/stable/strategy-101/
- https://www.freqtrade.io/en/stable/strategy-customization/
- https://www.freqtrade.io/en/stable/strategy-callbacks/
