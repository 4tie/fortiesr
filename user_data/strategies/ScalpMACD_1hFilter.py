from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpMACD_1hFilter(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.015
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 100

    def informative_pairs(self):
        if self.dp and self.dp.current_whitelist():
            return [(p, "1h", "spot") for p in self.dp.current_whitelist()]
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        macd = ta.macd(dataframe["close"])
        dataframe["macd"] = macd["MACD_12_26_9"]
        dataframe["macdsignal"] = macd["MACDs_12_26_9"]
        stoch = ta.stochrsi(dataframe["close"], length=14)
        dataframe["stoch_rsi"] = stoch["STOCHRSIk_14_14_3_3"]
        if self.dp:
            one_hour = self.dp.get_pair_dataframe(metadata["pair"], "1h", "spot")
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
                dataframe["h1_ema_200"] = 0.0
                dataframe["h1_close"] = float("inf")
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["macd"], dataframe["macdsignal"]) &
                (dataframe["stoch_rsi"] < 20) &
                (dataframe["h1_close"] > dataframe["h1_ema_200"])
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "macd_stoch_1h_uptrend")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_below(dataframe["macd"], dataframe["macdsignal"]),
            ["exit_long", "exit_tag"],
        ] = (1, "macd_cross_below")
        return dataframe
