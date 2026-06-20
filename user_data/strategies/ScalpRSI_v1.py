
import talib.abstract as ta
import pandas as pd
from freqtrade.strategy import IntParameter, IStrategy


class ScalpRSI_v1(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "5m"

    minimal_roi = {"0": 0.02, "30": 0.01, "120": 0.005, "360": 0}
    stoploss = -0.08

    rsi_buy = IntParameter(15, 35, default=25, space="buy")
    rsi_sell = IntParameter(60, 85, default=75, space="sell")
    rsi_period = IntParameter(5, 14, default=7, space="buy")

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=int(self.rsi_period.value))
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['rsi'] < self.rsi_buy.value),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['rsi'] > self.rsi_sell.value),
            'exit_long'] = 1
        return dataframe
