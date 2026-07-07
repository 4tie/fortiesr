# Freqtrade Strategies 101: A Quick Start for Strategy Development

## Required Knowledge

A strategy in Freqtrade is a Python class that defines the logic for buying and selling cryptocurrency assets.

### Assets

Assets are defined as pairs, which represent the coin and the stake. The coin is the asset you are trading using another currency as the stake.

- **pairs**: Trading pairs (e.g., BTC/USDT)
- **coin**: The cryptocurrency being traded
- **stake**: The currency used for trading

### Candles

Data is supplied by the exchange in the form of candles, which are made up of six values: date, open, high, low, close and volume.

- **date**: Timestamp of the candle
- **open**: Opening price
- **high**: Highest price
- **low**: Lowest price
- **close**: Closing price
- **volume**: Trading volume

### Technical Analysis

Technical analysis functions analyze the candle data using various computational and statistical formulae, and produce secondary values called indicators.

- **indicators**: Calculated values from technical analysis

### Signals

Indicators are analyzed on the asset pair candles to generate signals.

- **signals**: Buy/sell indications based on indicators

### Orders

Signals are turned into orders on a cryptocurrency exchange, i.e., trades.

- **orders**: Buy/sell orders on the exchange
- **trades**: Executed orders

### Entry and Exit

We use the terms entry and exit instead of buying and selling because Freqtrade supports both long and short trades.

- **entry**: Opening a position (buying for long, selling for short)
- **exit**: Closing a position (selling for long, buying for short)
- **long**: You buy the coin based on a stake, e.g., buying BTC using USDT as your stake, and you make a profit by selling the coin at a higher rate than you paid for. In long trades, profits are made by the coin value going up versus the stake.
- **short**: You borrow capital from the exchange in the form of the coin, and you pay back the stake value of the coin later. In short trades, profits are made by the coin value going down versus the stake (you pay the loan off at a lower rate).

Whilst Freqtrade supports spot and futures markets for certain exchanges, for simplicity we will focus on spot (long) trades only.

## Structure of a Basic Strategy

### Main dataframe

Freqtrade strategies use a tabular data structure with rows and columns known as a dataframe to generate signals to enter and exit trades.

- **dataframe**: Tabular data structure with rows and columns

Each pair in your configured pairlist has its own dataframe. Dataframes are indexed by the date column, e.g., 2024-06-31 12:00.

The next 5 columns represent the open, high, low, close and volume (OHLCV) data.

### Populate indicator values

The `populate_indicators` function adds columns to the dataframe that represent the technical analysis indicator values.

Examples of common indicators include Relative Strength Index, Bollinger Bands, Money Flow Index, Moving Average, and Average True Range.

Columns are added to the dataframe by calling technical analysis functions, e.g., ta-lib's RSI function `ta.RSI()`, and assigning them to a column name, e.g., `rsi`.

```python
dataframe['rsi'] = ta.RSI(dataframe)
```

Different libraries work in different ways to generate indicator values. Please check the documentation of each library to understand how to integrate it into your strategy. You can also check the [Freqtrade example strategies](https://github.com/freqtrade/freqtrade-strategies) to give you ideas.

### Populate entry signals

The `populate_entry_trend` function defines conditions for an entry signal.

The dataframe column `enter_long` is added to the dataframe, and when a value of 1 is in this column, Freqtrade sees an entry signal.

To enter short trades, use the `enter_short` column.

### Populate exit signals

The `populate_exit_trend` function defines conditions for an exit signal.

The dataframe column `exit_long` is added to the dataframe, and when a value of 1 is in this column, Freqtrade sees an exit signal.

To exit short trades, use the `exit_short` column.

## A simple strategy

Here's a simple example strategy structure:

```python
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta

class MyStrategy(IStrategy):
    
    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Add indicators
        dataframe['rsi'] = ta.RSI(dataframe)
        dataframe['ema_fast'] = ta.EMA(dataframe, timeperiod=12)
        dataframe['ema_slow'] = ta.EMA(dataframe, timeperiod=26)
        return dataframe
    
    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Entry conditions
        dataframe.loc[
            (
                (dataframe['rsi'] < 30) &
                (dataframe['ema_fast'] > dataframe['ema_slow'])
            ),
            'enter_long'
        ] = 1
        return dataframe
    
    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Exit conditions
        dataframe.loc[
            (
                (dataframe['rsi'] > 70)
            ),
            'exit_long'
        ] = 1
        return dataframe
```

## Making trades

Once your strategy is defined, you can run it in dry-run mode to test it without risking real money:

```bash
freqtrade trade --strategy MyStrategy --config config.json
```

## Backtesting and forward testing

### Assessing backtesting and dry run results

Backtesting allows you to test your strategy against historical data to see how it would have performed.

```bash
freqtrade backtesting --strategy MyStrategy --timerange 20240101-20240630
```

## Controlling or monitoring a running bot

### Logs

The bot logs its activities to the log file specified in your configuration. You can monitor these logs to see what the bot is doing.

## Final Thoughts

Strategy development is an iterative process. Start with a simple strategy, backtest it, analyze the results, and refine it based on your findings.

## Conclusion

This quick start guide covers the basics of strategy development in Freqtrade. For more advanced topics, see the strategy customization and strategy callbacks documentation.
