from freqtrade.strategy import IStrategy, DecimalParameter, IntParameter
from pandas import DataFrame
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class DualMomentum(IStrategy):
    can_short: bool = False
    INTERFACE_VERSION: int = 3

    minimal_roi = {}
    stoploss = -0.5
    timeframe = "1h"
    process_only_new_candles = True
    startup_candle_count = 100

    ema_fast = IntParameter(8, 20, default=12, space="buy", optimize=True)
    ema_slow = IntParameter(20, 50, default=26, space="buy", optimize=True)
    sma_period = IntParameter(10, 40, default=20, space="buy", optimize=True)

    def informative_pairs(self):
        pairs = self.dp.current_whitelist()
        return [(pair, "1d", "spot") for pair in pairs]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.ema_fast.value)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.ema_slow.value)

        if self.dp:
            daily = self.dp.get_pair_dataframe(metadata["pair"], "1d", "spot")
            daily["sma"] = ta.SMA(daily, timeperiod=self.sma_period.value)
            dataframe["daily_sma"] = daily["sma"].reindex(index=dataframe.index, method="ffill")
            dataframe["daily_close"] = daily["close"].reindex(index=dataframe.index, method="ffill")
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"])
                & (dataframe["daily_close"] > dataframe["daily_sma"])
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
