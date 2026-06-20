from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpEMA(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.015
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_fast"] = ta.ema(dataframe["close"], length=7)
        dataframe["ema_slow"] = ta.ema(dataframe["close"], length=14)
        dataframe["rsi"] = ta.rsi(dataframe["close"], length=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"]) &
                (dataframe["rsi"] < 70)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "ema_cross_rsi")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_below(dataframe["ema_fast"], dataframe["ema_slow"]),
            ["exit_long", "exit_tag"],
        ] = (1, "ema_cross_below")
        return dataframe
