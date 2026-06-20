from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta



class ShortDonchian(IStrategy):
    can_short = True
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.025
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["dc_lower"] = dataframe["low"].rolling(20).min()
        dataframe["dc_mid"] = (dataframe["high"].rolling(20).max() + dataframe["low"].rolling(20).min()) / 2
        rsi = ta.rsi(dataframe["close"], length=14)
        dataframe["rsi"] = rsi
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["close"] < dataframe["dc_lower"].shift(1)) &
                (dataframe["rsi"] < 50)
            ),
            ["enter_short", "enter_tag"],
        ] = (1, "short_breakdown")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["close"] > dataframe["dc_mid"]),
            ["exit_short", "exit_tag"],
        ] = (1, "exit_to_mid")
        return dataframe
