from freqtrade.strategy import IntParameter, DecimalParameter, IStrategy
from pandas import DataFrame
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class MomentumRobust(IStrategy):
    INTERFACE_VERSION: int = 3

    minimal_roi = {
        "0": 0.10,
        "60": 0.05,
        "120": 0.025,
        "240": 0.01,
        "480": 0,
    }

    stoploss = -0.08
    timeframe = "15m"
    trailing_stop = True
    trailing_stop_positive = 0.01
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = True
    process_only_new_candles = True
    startup_candle_count = 60

    cooldown_lookback = 1

    ema_fast   = IntParameter(5,  20, default=9,  space="buy", optimize=True)
    ema_slow   = IntParameter(20, 60, default=30, space="buy", optimize=True)

    rsi_buy_threshold = IntParameter(20, 75, default=65, space="buy", optimize=True)
    rsi_sell_threshold = IntParameter(65, 95, default=80, space="sell", optimize=True)

    min_volume_mult = DecimalParameter(0.5, 3.0, default=1.0, space="buy", optimize=False)

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
                (dataframe["ema_fast"] > dataframe["ema_slow"])
                & (dataframe["rsi"] < self.rsi_buy_threshold.value)
                & (dataframe["volume"] > dataframe["volume_median"] * self.min_volume_mult.value)
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["rsi"], self.rsi_sell_threshold.value)
            ),
            "exit_long",
        ] = 1
        return dataframe
