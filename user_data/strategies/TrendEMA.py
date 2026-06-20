import talib.abstract as ta
import pandas as pd
from freqtrade.strategy import IStrategy


class TrendEMA(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "1h"

    minimal_roi = {"0": 10}
    stoploss = -0.99
    trailing_stop = False

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe['ema50'] = ta.EMA(dataframe, timeperiod=50)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['close'] > dataframe['ema50']) &
            (dataframe['close'].shift(1) <= dataframe['ema50'].shift(1)),
            'enter_long'
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['close'] < dataframe['ema50']) &
            (dataframe['close'].shift(1) >= dataframe['ema50'].shift(1)),
            'exit_long'
        ] = 1
        return dataframe
