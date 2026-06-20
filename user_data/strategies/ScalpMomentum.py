from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpMomentum(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.012
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_7"] = ta.ema(dataframe["close"], length=7)
        dataframe["ema_slope"] = dataframe["ema_7"] - dataframe["ema_7"].shift(1)
        dataframe["volume_sma_20"] = ta.sma(dataframe["volume"], length=20)
        dataframe["volume_ratio"] = dataframe["volume"] / dataframe["volume_sma_20"]
        dataframe["rsi"] = ta.rsi(dataframe["close"], length=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["ema_slope"] > 0) &
                (dataframe["volume_ratio"] > 1.5) &
                (dataframe["rsi"] > 50) &
                (dataframe["rsi"] < 80)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "momentum_vol_spike")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            dataframe["ema_slope"] < 0,
            ["exit_long", "exit_tag"],
        ] = (1, "momentum_fade")
        return dataframe
