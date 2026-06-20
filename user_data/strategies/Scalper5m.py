from freqtrade.strategy import IStrategy
from freqtrade.strategy.parameters import IntParameter, DecimalParameter
from pandas import DataFrame
import pandas_ta as ta


def _spot(name):
    return name.split(":")[0]


class Scalper5m(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3

    timeframe = "5m"
    startup_candle_count = 200

    use_exit_signal = False
    use_custom_stoploss = False

    # Hyperopt spaces
    buy_rsi = IntParameter(28, 42, default=35, space="buy")
    sell_rsi = IntParameter(58, 72, default=65, space="sell")
    buy_adx = IntParameter(18, 28, default=22, space="buy")
    buy_vol = DecimalParameter(0.6, 1.4, default=0.8, space="buy")
    buy_atr_min = DecimalParameter(0.1, 0.3, default=0.15, space="buy")
    buy_atr_max = DecimalParameter(1.8, 3.0, default=2.5, space="buy")

    minimal_roi = {}

    stoploss = -0.008

    trailing_stop = True
    trailing_stop_positive = 0.002
    trailing_stop_positive_offset = 0.003
    trailing_only_offset_is_reached = True

    process_only_new_candles = True

    def informative_pairs(self):
        if self.dp and self.dp.current_whitelist():
            return [(_spot(p), "1h", "spot") for p in self.dp.current_whitelist()]
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        pair = _spot(metadata["pair"])

        dataframe["ema_20"] = ta.ema(dataframe["close"], length=20)
        dataframe["rsi"] = ta.rsi(dataframe["close"], length=14)
        adx = ta.adx(dataframe["high"], dataframe["low"], dataframe["close"], length=14)
        dataframe["adx"] = adx["ADX_14"]
        atr_raw = ta.atr(dataframe["high"], dataframe["low"], dataframe["close"], length=14)
        dataframe["atr_pct"] = atr_raw / dataframe["close"] * 100
        dataframe["vol_sma"] = dataframe["volume"].rolling(20).mean()
        dataframe["vol_ratio"] = dataframe["volume"] / dataframe["vol_sma"]

        if self.dp:
            hourly = self.dp.get_pair_dataframe(pair, "1h", "spot")
            if hourly is not None and not hourly.empty:
                if "date" not in hourly.columns:
                    hourly = hourly.reset_index()
                hourly["ema_12"] = ta.ema(hourly["close"], length=12)
                hourly["ema_26"] = ta.ema(hourly["close"], length=26)
                hourly["rsi_1h"] = ta.rsi(hourly["close"], length=14)
                hourly_idx = hourly.set_index("date")
                for col in ["ema_12", "ema_26", "rsi_1h"]:
                    hourly_idx[col] = hourly_idx[col].ffill()
                df_idx = dataframe.set_index("date")
                for col in ["ema_12", "ema_26", "rsi_1h"]:
                    dataframe[f"1h_{col}"] = hourly_idx[col].reindex(
                        df_idx.index, method="ffill"
                    ).values
            else:
                dataframe["1h_ema_12"] = 0.0
                dataframe["1h_ema_26"] = 0.0
                dataframe["1h_rsi_1h"] = 50.0

        dataframe["regime"] = "chop"
        bull = (
            (dataframe["1h_ema_12"] > dataframe["1h_ema_26"]) &
            (dataframe["1h_rsi_1h"] > 50)
        )
        bear = (
            (dataframe["1h_ema_12"] < dataframe["1h_ema_26"]) &
            (dataframe["1h_rsi_1h"] < 50)
        )
        dataframe.loc[bull, "regime"] = "bull"
        dataframe.loc[bear, "regime"] = "bear"

        dataframe["bullish"] = dataframe["close"] > dataframe["open"]
        dataframe["bearish"] = dataframe["close"] < dataframe["open"]

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        has_volume = dataframe["vol_ratio"] > self.buy_vol.value
        not_chop = dataframe["adx"] > self.buy_adx.value
        vol_ok = (dataframe["atr_pct"] > self.buy_atr_min.value) & (dataframe["atr_pct"] < self.buy_atr_max.value)

        conditions = has_volume & not_chop & vol_ok

        dataframe.loc[
            (
                conditions &
                (dataframe["regime"] == "bull") &
                (dataframe["rsi"] < self.buy_rsi.value) &
                (dataframe["close"] < dataframe["ema_20"]) &
                (dataframe["bullish"])
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "long_pullback")

        dataframe.loc[
            (
                conditions &
                (dataframe["regime"] == "bear") &
                (dataframe["rsi"] > self.sell_rsi.value) &
                (dataframe["close"] > dataframe["ema_20"]) &
                (dataframe["bearish"])
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_pop")

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
