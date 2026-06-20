from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpBB(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.01
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        bb = ta.bbands(dataframe["close"], length=20, std=2)
        dataframe["bb_lower"] = bb["BBL_20_2.0"]
        dataframe["bb_middle"] = bb["BBM_20_2.0"]
        dataframe["bb_upper"] = bb["BBU_20_2.0"]
        dataframe["rsi"] = ta.rsi(dataframe["close"], length=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] < dataframe["bb_lower"]) &
                (dataframe["rsi"] < 30)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "bb_oversold")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            dataframe["close"] > dataframe["bb_middle"],
            ["exit_long", "exit_tag"],
        ] = (1, "bb_mid_return")
        return dataframe
