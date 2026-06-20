from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta


class ScalpReversion(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.012
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        bb = ta.bbands(dataframe["close"], length=20, std=2.0)
        dataframe["bb_upper"] = bb["BBU_20_2.0"]
        dataframe["bb_lower"] = bb["BBL_20_2.0"]
        dataframe["bb_mid"] = bb["BBM_20_2.0"]
        rsi = ta.rsi(dataframe["close"], length=14)
        dataframe["rsi"] = rsi
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] < dataframe["bb_lower"]) &
                (dataframe["rsi"] < 30)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "long_oversold")
        dataframe.loc[
            (
                (dataframe["close"] > dataframe["bb_upper"]) &
                (dataframe["rsi"] > 70)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_overbought")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["close"] > dataframe["bb_mid"]),
            ["exit_long", "exit_tag"],
        ] = (1, "exit_to_mid")
        dataframe.loc[
            (dataframe["close"] < dataframe["bb_mid"]),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_to_mid")
        return dataframe
