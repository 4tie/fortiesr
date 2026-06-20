
import talib.abstract as ta
import pandas as pd
from freqtrade.strategy import IntParameter, IStrategy


class HybridScalp_v1(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "5m"

    minimal_roi = {"0": 0.02, "45": 0.01, "120": 0.005, "240": 0}
    stoploss = -0.035

    buy_tema_period = IntParameter(5, 20, default=8, space="buy")
    buy_rsi_min = IntParameter(45, 65, default=55, space="buy")
    buy_adx_min = IntParameter(15, 35, default=20, space="buy")
    sell_tema_period = IntParameter(5, 20, default=12, space="sell")
    sell_rsi_max = IntParameter(55, 80, default=70, space="sell")

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        bp = int(self.buy_tema_period.value)
        dataframe['tema_short'] = ta.TEMA(dataframe, timeperiod=bp)
        dataframe['tema_long'] = ta.TEMA(dataframe, timeperiod=bp * 2)
        dataframe['ema200'] = ta.EMA(dataframe, timeperiod=200)
        dataframe['tema_sell'] = ta.TEMA(dataframe, timeperiod=int(self.sell_tema_period.value))
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        dataframe['adx'] = ta.ADX(dataframe, timeperiod=14)
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['close'] > dataframe['ema200']) &
            (dataframe['tema_short'] > dataframe['tema_long']) &
            (dataframe['rsi'] > self.buy_rsi_min.value) &
            (dataframe['adx'] > self.buy_adx_min.value),
            'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        dataframe.loc[
            (dataframe['tema_short'] < dataframe['tema_sell']) |
            (dataframe['rsi'] > self.sell_rsi_max.value) |
            (dataframe['close'] < dataframe['ema200']),
            'exit_long'] = 1
        return dataframe
