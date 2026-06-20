
import talib.abstract as ta
import pandas as pd
from freqtrade.strategy.interface import IStrategy
from freqtrade.strategy.parameters import IntParameter


class OllamaScalp_v1(IStrategy):
    """
    5m scalping strategy.
    """

    # Strategy interface version
    INTERFACE_VERSION = 3

    # Minimal ROI for trades
    minimal_roi = {
        "0": 0.03,
        "60": 0.015,
        "120": 0
    }

    # Stoploss
    stoploss = -0.05

    # Trailing stop
    trailing_stop = True
    trailing_stop_positive = 0.01
    trailing_stop_positive_offset = 0.02

    # Parameters
    buy_ema_short = IntParameter(5, 15, default=8)
    buy_ema_long = IntParameter(15, 30, default=21)
    buy_rsi_min = IntParameter(40, 60, default=50)
    sell_ema_short = IntParameter(5, 15, default=13)
    sell_rsi_max = IntParameter(30, 50, default=40)

    timeframe = '5m'

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """
        Adds technical indicators to the dataframe.
        """
        dataframe['ema_short'] = ta.EMA(dataframe, timeperiod=self.buy_ema_short.value)
        dataframe['ema_long'] = ta.EMA(dataframe, timeperiod=self.buy_ema_long.value)
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        dataframe['ema_sell'] = ta.EMA(dataframe, timeperiod=self.sell_ema_short.value)
        dataframe['volume_sma'] = ta.SMA(dataframe['volume'], timeperiod=20)

        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """
        Determines entry conditions for trades.
        """
        dataframe.loc[
            (dataframe['ema_short'] > dataframe['ema_long']) &
            (dataframe['rsi'] > self.buy_rsi_min.value) &
            (dataframe['volume'] > dataframe['volume_sma']),
            'enter_long'] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """
        Determines exit conditions for trades.
        """
        dataframe.loc[
            (dataframe['ema_short'] < dataframe['ema_sell']) |
            (dataframe['rsi'] < self.sell_rsi_max.value),
            'exit_long'] = 1

        return dataframe
