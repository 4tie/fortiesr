from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta


class ShortBreakdown(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.03
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["low_20"] = dataframe["low"].rolling(20).min()
        dataframe["high_20"] = dataframe["high"].rolling(20).max()
        dataframe["rsi"] = ta.rsi(dataframe["close"], length=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] < dataframe["low_20"].shift(1)) &
                (dataframe["rsi"] < 50)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_breakdown")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] > dataframe["high_20"].shift(1))
            ),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_short_breakup")
        return dataframe
