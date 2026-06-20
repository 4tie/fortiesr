from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpDualFilter(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.01
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 100
    trailing_stop = True
    trailing_stop_positive = 0.004
    trailing_stop_positive_offset = 0.006
    trailing_only_offset_is_reached = True

    def informative_pairs(self):
        if self.dp and self.dp.current_whitelist():
            return [(p, "1h", "spot") for p in self.dp.current_whitelist()] + \
                   [(p, "1d", "spot") for p in self.dp.current_whitelist()]
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        macd = ta.macd(dataframe["close"])
        dataframe["macd"] = macd["MACD_12_26_9"]
        dataframe["macdsignal"] = macd["MACDs_12_26_9"]
        if self.dp:
            daily = self.dp.get_pair_dataframe(metadata["pair"], "1d", "spot")
            one_hour = self.dp.get_pair_dataframe(metadata["pair"], "1h", "spot")
            if daily is not None and not daily.empty:
                if "date" not in daily.columns:
                    daily = daily.reset_index()
                daily_sma = ta.sma(daily["close"], length=20)
                daily_idx = daily.set_index("date")
                daily_idx["sma20"] = daily_sma
                daily_idx["sma20"] = daily_idx["sma20"].ffill()
                hourly_idx = dataframe.set_index("date")
                dataframe["daily_close"] = daily_idx["close"].reindex(
                    hourly_idx.index, method="ffill"
                ).values
                dataframe["daily_sma20"] = daily_idx["sma20"].reindex(
                    hourly_idx.index, method="ffill"
                ).values
            else:
                dataframe["daily_close"] = float("inf")
                dataframe["daily_sma20"] = 0.0
            if one_hour is not None and not one_hour.empty:
                if "date" not in one_hour.columns:
                    one_hour = one_hour.reset_index()
                one_hour["ema_200"] = ta.ema(one_hour["close"], length=200)
                one_hour_idx = one_hour.set_index("date")
                hourly_idx = dataframe.set_index("date")
                dataframe["h1_ema_200"] = one_hour_idx["ema_200"].reindex(
                    hourly_idx.index, method="ffill"
                ).values
                dataframe["h1_close"] = one_hour_idx["close"].reindex(
                    hourly_idx.index, method="ffill"
                ).values
            else:
                dataframe["h1_close"] = float("inf")
                dataframe["h1_ema_200"] = 0.0
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["macd"], dataframe["macdsignal"]) &
                (dataframe["h1_close"] > dataframe["h1_ema_200"]) &
                (dataframe["daily_close"] > dataframe["daily_sma20"])
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "dual_filter_macd")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_below(dataframe["macd"], dataframe["macdsignal"]),
            ["exit_long", "exit_tag"],
        ] = (1, "macd_cross_below")
        return dataframe
