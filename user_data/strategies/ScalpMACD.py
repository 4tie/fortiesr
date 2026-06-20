from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas_ta as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class ScalpMACD(IStrategy):
    can_short = False
    INTERFACE_VERSION = 3
    minimal_roi = {}
    stoploss = -0.015
    timeframe = "15m"
    process_only_new_candles = True
    startup_candle_count = 40

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        macd = ta.macd(dataframe["close"])
        dataframe["macd"] = macd["MACD_12_26_9"]
        dataframe["macdsignal"] = macd["MACDs_12_26_9"]
        stoch = ta.stochrsi(dataframe["close"], length=14)
        dataframe["stoch_rsi"] = stoch["STOCHRSIk_14_14_3_3"]
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (
                qtpylib.crossed_above(dataframe["macd"], dataframe["macdsignal"]) &
                (dataframe["stoch_rsi"] < 20)
            ),
            ["enter_long", "enter_tag"],
        ] = (1, "macd_stoch_oversold")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            qtpylib.crossed_below(dataframe["macd"], dataframe["macdsignal"]),
            ["exit_long", "exit_tag"],
        ] = (1, "macd_cross_below")
        return dataframe
