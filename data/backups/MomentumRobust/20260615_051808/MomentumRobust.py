from freqtrade.strategy import IntParameter, DecimalParameter, IStrategy
from pandas import DataFrame
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class MomentumRobust(IStrategy):
    INTERFACE_VERSION: int = 3

    minimal_roi = {
        "0": 0.10,
        "30": 0.05,
        "60": 0.025,
        "120": 0.01,
        "240": 0,
    }

    stoploss = -0.06
    timeframe = "15m"
    trailing_stop = True
    trailing_stop_positive = 0.01
    trailing_stop_positive_offset = 0.03
    trailing_only_offset_is_reached = True
    process_only_new_candles = True
    startup_candle_count = 100

    cooldown_lookback = 2

    ema_fast   = IntParameter(5,  15, default=8,  space="buy", optimize=True)
    ema_slow   = IntParameter(20, 50, default=21, space="buy", optimize=True)

    rsi_buy_threshold = IntParameter(30, 70, default=60, space="buy", optimize=True)

    min_volume_mult = DecimalParameter(0.5, 2.0, default=1.0, space="buy", optimize=False)

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.ema_fast.value)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.ema_slow.value)
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["volume_median"] = (
            dataframe["volume"].rolling(window=20, min_periods=1).median()
        )
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"])
                & (dataframe["rsi"] < self.rsi_buy_threshold.value)
                & (dataframe["volume"] > dataframe["volume_median"] * self.min_volume_mult.value)
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_below(dataframe["rsi"], 50)
            ),
            "exit_long",
        ] = 1
        return dataframe
