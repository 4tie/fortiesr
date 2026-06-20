from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta


class ShortSuperTrend(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.025
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        st = ta.supertrend(dataframe["high"], dataframe["low"], dataframe["close"], length=10, multiplier=3.0)
        dataframe["st_dir"] = st["SUPERTd_10_3.0"]
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["st_dir"] == 1),
            ["enter_long", "enter_tag"],
        ] = (1, "long_uptrend")
        dataframe.loc[
            (dataframe["st_dir"] == -1),
            ["enter_short", "enter_tag"],
        ] = (1, "short_downtrend")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["st_dir"] == -1),
            ["exit_long", "exit_tag"],
        ] = (1, "exit_to_short")
        dataframe.loc[
            (dataframe["st_dir"] == 1),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_to_long")
        return dataframe
