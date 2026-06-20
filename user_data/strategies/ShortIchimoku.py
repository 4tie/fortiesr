from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ShortIchimoku(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.02
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 100

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        ichimoku = ta.ichimoku(dataframe["high"], dataframe["low"], dataframe["close"])
        dataframe["tenkan"] = ichimoku[0]["ITS_9"]
        dataframe["kijun"] = ichimoku[0]["IKS_26"]
        dataframe["senkou_a"] = ichimoku[0]["ISA_9"]
        dataframe["senkou_b"] = ichimoku[0]["ISB_26"]
        dataframe["cloud_green"] = dataframe["senkou_a"] > dataframe["senkou_b"]
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["tenkan"], dataframe["kijun"]) &
                (dataframe["close"] > dataframe["senkou_a"]) &
                (dataframe["close"] > dataframe["senkou_b"])
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "long_ichimoku")
        dataframe.loc[
            (
                qtpylib.crossed_below(dataframe["tenkan"], dataframe["kijun"]) &
                (dataframe["close"] < dataframe["senkou_a"]) &
                (dataframe["close"] < dataframe["senkou_b"])
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_ichimoku")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_below(dataframe["tenkan"], dataframe["kijun"]),
            ["exit_long", "exit_tag"],
        ] = (1, "exit_to_short")
        dataframe.loc[
            qtpylib.crossed_above(dataframe["tenkan"], dataframe["kijun"]),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_to_long")
        return dataframe
