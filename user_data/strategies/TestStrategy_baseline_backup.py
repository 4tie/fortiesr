from freqtrade.strategy.interface import IStrategy

class TestStrategy(IStrategy):
    timeframe = '5m'
    minimal_roi = {"0": 0.05}
    stoploss = -0.05
    trailing_stop = True

    def populate_indicators(self, dataframe, metadata):
        return dataframe

    def populate_buy_trend(self, dataframe, metadata):
        dataframe['buy'] = 0
        return dataframe

    def populate_sell_trend(self, dataframe, metadata):
        dataframe['sell'] = 0
        return dataframe
