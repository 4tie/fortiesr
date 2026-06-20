from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpSuper(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.02
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 20

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        supertrend = ta.supertrend(dataframe["high"], dataframe["low"], dataframe["close"], length=10, multiplier=3)
        dataframe["supertrend"] = supertrend["SUPERT_10_3.0"]
        dataframe["supertrend_direction"] = supertrend["SUPERTd_10_3.0"]
        dataframe["rsi"] = ta.rsi(dataframe["close"], length=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["supertrend_direction"], 0) &
                (dataframe["rsi"] > 50)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "super_green_rsi")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_below(dataframe["supertrend_direction"], 0),
            ["exit_long", "exit_tag"],
        ] = (1, "super_red")
        return dataframe
