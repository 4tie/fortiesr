from freqtrade.strategy.interface import IStrategy
from pandas import DataFrame


class SmokeTestStrategy(IStrategy):
    """Minimal strategy for backend smoke testing."""

    timeframe = "1h"
    minimal_roi = {"0": 0.02}
    stoploss = -0.08
    trailing_stop = False
    startup_candle_count = 10

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["sma_short"] = dataframe["close"].rolling(3).mean()
        dataframe["sma_long"] = dataframe["close"].rolling(8).mean()
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["sma_short"] > dataframe["sma_long"]) &
                (dataframe["sma_short"].shift(1) <= dataframe["sma_long"].shift(1))
            ),
            "enter_long",
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                (dataframe["sma_short"] < dataframe["sma_long"]) &
                (dataframe["sma_short"].shift(1) >= dataframe["sma_long"].shift(1))
            ),
            "exit_long",
        ] = 1
        return dataframe
