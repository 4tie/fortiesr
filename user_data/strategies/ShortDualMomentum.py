from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ShortDualMomentum(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.02
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 100

    def informative_pairs(self):
        if self.dp and self.dp.current_whitelist():
            return [(p, "1d", "spot") for p in self.dp.current_whitelist()]
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_fast"] = ta.ema(dataframe["close"], length=12)
        dataframe["ema_slow"] = ta.ema(dataframe["close"], length=26)
        if self.dp:
            daily = self.dp.get_pair_dataframe(metadata["pair"], "1d", "spot")
            if daily is not None and not daily.empty:
                if "date" not in daily.columns:
                    daily = daily.reset_index()
                daily_sma = ta.sma(daily["close"], length=20)
                daily_idx = daily.set_index("date")
                daily_idx["sma20"] = daily_sma
                daily_idx["sma20"] = daily_idx["sma20"].ffill()
                hourly_idx = dataframe.set_index("date")
                dataframe["daily_sma"] = daily_idx["sma20"].reindex(
                    hourly_idx.index, method="ffill"
                ).values
                dataframe["daily_close"] = daily_idx["close"].reindex(
                    hourly_idx.index, method="ffill"
                ).values
            else:
                dataframe["daily_sma"] = 0.0
                dataframe["daily_close"] = 0.0
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"]) &
                (dataframe["daily_close"] > dataframe["daily_sma"])
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "long_daily_uptrend")
        dataframe.loc[
            (
                qtpylib.crossed_below(dataframe["ema_fast"], dataframe["ema_slow"]) &
                (dataframe["daily_close"] < dataframe["daily_sma"])
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_daily_downtrend")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_below(dataframe["ema_fast"], dataframe["ema_slow"]),
            ["exit_long", "exit_tag"],
        ] = (1, "exit_long_ema")
        dataframe.loc[
            qtpylib.crossed_above(dataframe["ema_fast"], dataframe["ema_slow"]),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_short_ema")
        return dataframe
