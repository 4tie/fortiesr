from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpDonchian(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.008
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40
    trailing_stop = True
    trailing_stop_positive = 0.003
    trailing_stop_positive_offset = 0.005
    trailing_only_offset_is_reached = True

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["dc_upper"] = dataframe["close"].rolling(20).max()
        dataframe["dc_lower"] = dataframe["close"].rolling(10).min()
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] > dataframe["dc_upper"].shift(1)) &
                (dataframe["volume"] > dataframe["volume"].rolling(20).mean())
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "donchian_breakout")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            dataframe["close"] < dataframe["dc_lower"].shift(1),
            ["exit_long", "exit_tag"],
        ] = (1, "donchian_stop")
        return dataframe
