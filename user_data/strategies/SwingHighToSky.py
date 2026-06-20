from freqtrade.strategy import IStrategy
from freqtrade.strategy import IntParameter
from pandas import DataFrame
import talib.abstract as ta


class SwingHighToSky(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = '15m'

    stoploss = -0.025

    minimal_roi = {"0": 0.05, "120": 0.02, "240": 0}

    trailing_stop = True
    trailing_stop_positive = 0.012
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = True
    use_exit_signal = False

    buy_cci = IntParameter(low=-200, high=200, default=-175, space='buy', optimize=True)
    buy_cciTime = IntParameter(low=40, high=80, default=72, space='buy', optimize=True)
    buy_rsi = IntParameter(low=60, high=95, default=90, space='buy', optimize=True)
    buy_rsiTime = IntParameter(low=20, high=50, default=36, space='buy', optimize=True)

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        cci_series = ta.CCI(dataframe, timeperiod=self.buy_cciTime.value)
        rsi_series = ta.RSI(dataframe, timeperiod=self.buy_rsiTime.value)

        dataframe.loc[
            (
                (cci_series < self.buy_cci.value) &
                (rsi_series < self.buy_rsi.value) &
                (dataframe['volume'] > 0)
            ),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
