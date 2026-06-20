from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ShortVWAP(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.015
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 100

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        tp = (dataframe["high"] + dataframe["low"] + dataframe["close"]) / 3
        dataframe["cum_vp"] = (tp * dataframe["volume"]).cumsum()
        dataframe["cum_vol"] = dataframe["volume"].cumsum()
        dataframe["vwap"] = dataframe["cum_vp"] / dataframe["cum_vol"]
        dataframe["vwap_dist"] = (dataframe["close"] - dataframe["vwap"]) / dataframe["vwap"] * 100
        dataframe["vwap_dist"] = (dataframe["close"] - dataframe["vwap"]) / dataframe["vwap"] * 100
        rsi = ta.rsi(dataframe["close"], length=14)
        dataframe["rsi"] = rsi
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["vwap_dist"] < -1.0) &
                (dataframe["rsi"] < 35)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "long_vwap_dip")
        dataframe.loc[
            (
                (dataframe["vwap_dist"] > 1.0) &
                (dataframe["rsi"] > 65)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_vwap_spike")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_above(dataframe["close"], dataframe["vwap"]),
            ["exit_long", "exit_tag"],
        ] = (1, "exit_above_vwap")
        dataframe.loc[
            qtpylib.crossed_below(dataframe["close"], dataframe["vwap"]),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_below_vwap")
        return dataframe
