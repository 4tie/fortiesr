from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ShortScalpROI(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {
        "0": 0.015,
        "45": 0.01,
        "120": 0.005,
    }
    stoploss = -0.03
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_7"] = ta.ema(dataframe["close"], length=7)
        dataframe["ema_14"] = ta.ema(dataframe["close"], length=14)
        rsi = ta.rsi(dataframe["close"], length=14)
        dataframe["rsi"] = rsi
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_below(dataframe["ema_7"], dataframe["ema_14"]) &
                (dataframe["rsi"] < 60)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_ema_cross")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
