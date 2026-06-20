from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta


class ShortROIOnly(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    use_exit_signal = False
    minimal_roi = {
        "0": 0.04,
        "120": 0.02,
        "360": 0.01,
        "720": 0,
    }
    stoploss = -0.03
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        bb = ta.bbands(dataframe["close"], length=20, std=2.0)
        dataframe["bb_upper"] = bb["BBU_20_2.0"]
        dataframe["bb_mid"] = bb["BBM_20_2.0"]
        rsi = ta.rsi(dataframe["close"], length=14)
        dataframe["rsi"] = rsi
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] > dataframe["bb_upper"]) &
                (dataframe["rsi"] > 65)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_overbought")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
