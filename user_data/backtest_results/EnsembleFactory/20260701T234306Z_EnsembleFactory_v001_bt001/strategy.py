import json
from pathlib import Path
from freqtrade.strategy import DecimalParameter, IntParameter, IStrategy
from pandas import DataFrame
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib

class EnsembleFactory(IStrategy):
    INTERFACE_VERSION: int = 3
    minimal_roi = {'0': 0.1, '30': 0.05, '60': 0.02, '120': 0.0}
    stoploss = -0.05
    timeframe = '5m'
    trailing_stop = False
    process_only_new_candles = True
    rsi_weight = DecimalParameter(0.0, 1.0, default=0.4, decimals=2, space='buy', optimize=True)
    macd_weight = DecimalParameter(0.0, 1.0, default=0.3, decimals=2, space='buy', optimize=True)
    bb_weight = DecimalParameter(0.0, 1.0, default=0.3, decimals=2, space='buy', optimize=True)
    consensus_threshold = DecimalParameter(0.1, 0.9, default=0.5, decimals=2, space='buy', optimize=True)
    rsi_oversold = IntParameter(20, 40, default=30, space='buy', optimize=True)
    rsi_period = IntParameter(10, 20, default=14, space='buy', optimize=False)

    def _load_live_weights(self):
        """Attempt to read override weights from ensemble_weights.json.

        Falls back to the hyperopt-optimised DecimalParameter values when the
        file is absent, malformed, or any key is missing.
        """
        try:
            p = Path(self.config.get('user_data_dir', '.')) / 'ensemble_weights.json'
            if p.exists():
                cfg = json.loads(p.read_text(encoding='utf-8'))
                return (float(cfg.get('rsi_weight', self.rsi_weight.value)), float(cfg.get('macd_weight', self.macd_weight.value)), float(cfg.get('bb_weight', self.bb_weight.value)), float(cfg.get('consensus_threshold', self.consensus_threshold.value)))
        except Exception as exc:
            logger.warning('Generator | failed to load ensemble_weights.json: %s', exc)
        return (self.rsi_weight.value, self.macd_weight.value, self.bb_weight.value, self.consensus_threshold.value)

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=self.rsi_period.value)
        macd = ta.MACD(dataframe, fastperiod=12, slowperiod=26, signalperiod=9)
        dataframe['macd'] = macd['macd']
        dataframe['macdsignal'] = macd['macdsignal']
        dataframe['macdhist'] = macd['macdhist']
        bollinger = qtpylib.bollinger_bands(qtpylib.typical_price(dataframe), window=20, stds=2)
        dataframe['bb_lowerband'] = bollinger['lower']
        dataframe['bb_upperband'] = bollinger['upper']
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        rsi_w, macd_w, bb_w, threshold = self._load_live_weights()
        rsi_vote = (dataframe['rsi'] < self.rsi_oversold.value).astype(float)
        macd_vote = qtpylib.crossed_above(dataframe['macd'], dataframe['macdsignal']).astype(float)
        bb_vote = (dataframe['close'] < dataframe['bb_lowerband']).astype(float)
        total_weight = rsi_w + macd_w + bb_w
        if total_weight > 0:
            score = (rsi_vote * rsi_w + macd_vote * macd_w + bb_vote * bb_w) / total_weight
        else:
            score = dataframe['close'] * 0
        dataframe.loc[(score >= threshold) & (dataframe['volume'] > 0), 'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe