from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpFastRSI(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.008
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 100
    trailing_stop = True
    trailing_stop_positive = 0.003
    trailing_stop_positive_offset = 0.005
    trailing_only_offset_is_reached = True

    def informative_pairs(self):
        if self.dp and self.dp.current_whitelist():
            return [(p, "1d", "spot") for p in self.dp.current_whitelist()]
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["rsi_7"] = ta.rsi(dataframe["close"], length=7)
        dataframe["rsi_14"] = ta.rsi(dataframe["close"], length=14)
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
                dataframe["daily_close"] = daily_idx["close"].reindex(
                    hourly_idx.index, method="ffill"
                ).values
                dataframe["daily_sma20"] = daily_idx["sma20"].reindex(
                    hourly_idx.index, method="ffill"
                ).values
            else:
                dataframe["daily_close"] = float("inf")
                dataframe["daily_sma20"] = 0.0
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["rsi_7"] < 20) &
                (dataframe["rsi_14"] < 30) &
                (dataframe["daily_close"] > dataframe["daily_sma20"])
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "fast_rsi_bounce")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            dataframe["rsi_7"] > 50,
            ["exit_long", "exit_tag"],
        ] = (1, "rsi_recovered")
        return dataframe
