import numpy as np
from freqtrade.strategy import IntParameter, DecimalParameter, IStrategy
from pandas import DataFrame
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class DualMomentum(IStrategy):
    can_short: bool = False

    INTERFACE_VERSION: int = 3

    minimal_roi = {
        "0": 0.02,
        "15": 0.015,
        "30": 0.008,
        "60": 0,
    }

    stoploss = -0.02
    timeframe = "30m"
    process_only_new_candles = True
    startup_candle_count = 100
    trailing_stop = True
    trailing_stop_positive = 0.005
    trailing_stop_positive_offset = 0.008
    trailing_only_offset_is_reached = True
    use_exit_signal = True
    ignore_roi_if_entry_signal = True

    # EMA periods (slower for 30m)
    ema_fast = IntParameter(8, 20, default=12, space="buy", optimize=True)
    ema_slow = IntParameter(30, 60, default=26, space="buy", optimize=True)

    # RSI entry zone
    rsi_min = IntParameter(40, 55, default=48, space="buy", optimize=True)
    rsi_max = IntParameter(55, 70, default=65, space="buy", optimize=True)

    # Exit when RSI drops below
    rsi_exit = IntParameter(25, 45, default=35, space="sell", optimize=True)

    # Volume filter
    volume_mult = DecimalParameter(0.8, 2.0, default=1.0, space="buy", optimize=False)

    # ATR volatility threshold
    atr_period = IntParameter(7, 21, default=14, space="buy", optimize=False)

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.ema_fast.value)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.ema_slow.value)
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["volume_median"] = (
            dataframe["volume"].rolling(window=20, min_periods=1).median()
        )
        dataframe["atr"] = ta.ATR(dataframe, timeperiod=self.atr_period.value)
        dataframe["atr_median"] = (
            dataframe["atr"].rolling(window=50, min_periods=1).median()
        )
        macd = ta.MACD(dataframe, fastperiod=12, slowperiod=26, signalperiod=9)
        dataframe["macd"] = macd["macd"]
        dataframe["macd_signal"] = macd["macdsignal"]
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"])
                & (dataframe["rsi"] > self.rsi_min.value)
                & (dataframe["rsi"] < self.rsi_max.value)
                & (dataframe["volume"] > dataframe["volume_median"] * self.volume_mult.value)
                & (dataframe["atr"] > dataframe["atr_median"])
                & (dataframe["macd"] > dataframe["macd_signal"])
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_below(dataframe["ema_fast"], dataframe["ema_slow"]),
            "exit_long",
        ] = 1
        return dataframe
