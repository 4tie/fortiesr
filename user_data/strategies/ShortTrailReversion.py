from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta


class ShortTrailReversion(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.05
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = True
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        bb = ta.bbands(dataframe["close"], length=20, std=2.0)
        dataframe["bb_upper"] = bb["BBU_20_2.0"]
        dataframe["bb_mid"] = bb["BBM_20_2.0"]
        rsi = ta.rsi(dataframe["close"], length=14)
        dataframe["rsi"] = rsi
        atr = ta.atr(dataframe["high"], dataframe["low"], dataframe["close"], length=14)
        dataframe["atr"] = atr
        dataframe["atr_pct"] = atr / dataframe["close"] * 100
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] > dataframe["bb_upper"]) &
                (dataframe["rsi"] > 65) &
                (dataframe["atr_pct"] > 0.5) &
                (dataframe["atr_pct"] < 3.0)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_overbought")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
