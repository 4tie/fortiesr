from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta


def _spot_pair(pair):
    return pair.split(":")[0]


class Short1hTrend(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.02
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 100

    def informative_pairs(self):
        if self.dp and self.dp.current_whitelist():
            return [(_spot_pair(p), "1h", "spot") for p in self.dp.current_whitelist()]
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema_12"] = ta.ema(dataframe["close"], length=12)
        if self.dp:
            spot_pair = _spot_pair(metadata["pair"])
            hourly = self.dp.get_pair_dataframe(spot_pair, "1h", "spot")
            if hourly is not None and not hourly.empty:
                if "date" not in hourly.columns:
                    hourly = hourly.reset_index()
                hourly["ema_12"] = ta.ema(hourly["close"], length=12)
                hourly["ema_26"] = ta.ema(hourly["close"], length=26)
                hourly["rsi"] = ta.rsi(hourly["close"], length=14)
                hourly_idx = hourly.set_index("date")
                for col in ["ema_12", "ema_26", "rsi"]:
                    hourly_idx[col] = hourly_idx[col].ffill()
                df_idx = dataframe.set_index("date")
                for col in ["ema_12", "ema_26", "rsi"]:
                    dataframe[f"1h_{col}"] = hourly_idx[col].reindex(
                        df_idx.index, method="ffill"
                    ).values
            else:
                dataframe["1h_ema_12"] = 0.0
                dataframe["1h_ema_26"] = 0.0
                dataframe["1h_rsi"] = 50.0
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["1h_ema_12"] < dataframe["1h_ema_26"]) &
                (dataframe["1h_rsi"] < 50) &
                (dataframe["close"] < dataframe["ema_12"])
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_1h_downtrend")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["close"] > dataframe["ema_12"]),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_above_ema12")
        return dataframe
