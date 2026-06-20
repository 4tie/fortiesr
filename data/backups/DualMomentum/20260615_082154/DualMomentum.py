from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas as pd
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class DualMomentum(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.5
    timeframe = "1h"
    process_only_new_candles = True
    startup_candle_count = 100

    def informative_pairs(self):
        return [("ETH/USDT", "1d", "spot")]

    def populate_indicators(self, dataframe, metadata):
        dataframe["ema_fast"] = ta.EMA(dataframe["close"].values, timeperiod=12)
        dataframe["ema_slow"] = ta.EMA(dataframe["close"].values, timeperiod=26)
        if self.dp:
            daily = self.dp.get_pair_dataframe(metadata["pair"], "1d", "spot")
            daily_idx = daily.set_index("date")
            daily_sma = ta.SMA(daily["close"].values, timeperiod=20)
            daily_idx["sma20"] = daily_sma
            daily_idx["sma20"] = daily_idx["sma20"].ffill()
            hourly_idx = dataframe.set_index("date")
            dataframe["daily_sma"] = daily_idx["sma20"].reindex(
                hourly_idx.index, method="ffill"
            ).values
            dataframe["daily_close_val"] = daily_idx["close"].reindex(
                hourly_idx.index, method="ffill"
            ).values
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        dataframe.loc[
            (qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"]) &
             (dataframe["daily_close_val"] > dataframe["daily_sma"])),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        dataframe.loc[
            qtpylib.crossed_below(dataframe["ema_fast"], dataframe["ema_slow"]),
            "exit_long",
        ] = 1
        return dataframe
