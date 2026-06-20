from freqtrade.strategy import IntParameter, DecimalParameter, IStrategy
from pandas import DataFrame
import talib.abstract as ta


class AutoQuantRobustV2(IStrategy):
    INTERFACE_VERSION: int = 3

    # ROI Table - conservative targets
    minimal_roi = {
        "0": 0.02,
        "60": 0.015,
        "120": 0.01,
        "240": 0.005,
        "480": 0,
    }

    # Conservative stoploss
    stoploss = -0.03

    # Timeframe
    timeframe = "1h"

    # Trailing stop
    trailing_stop = True
    trailing_stop_positive = 0.008
    trailing_stop_positive_offset = 0.015
    trailing_only_offset_is_reached = True

    # Process only new candles
    process_only_new_candles = True
    startup_candle_count = 120

    # ── Tunable Parameters for Optimizer ──
    
    # Trend filter parameters
    ema_fast = IntParameter(8, 20, default=12, space="buy", optimize=True)
    ema_slow = IntParameter(21, 50, default=26, space="buy", optimize=True)
    
    # Momentum parameters
    rsi_period = IntParameter(10, 20, default=14, space="buy", optimize=True)
    rsi_entry = IntParameter(35, 50, default=42, space="buy", optimize=True)
    rsi_exit = IntParameter(60, 80, default=70, space="sell", optimize=True)
    
    # Volume filter
    volume_factor = DecimalParameter(1.0, 2.0, default=1.3, decimals=1, space="buy", optimize=True)

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Trend indicators
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.ema_fast.value)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.ema_slow.value)
        
        # Momentum
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=self.rsi_period.value)
        
        # Volume
        dataframe["volume_mean"] = dataframe["volume"].rolling(window=20).mean()
        dataframe["volume_ratio"] = dataframe["volume"] / dataframe["volume_mean"]
        
        # ATR for volatility
        dataframe["atr"] = ta.ATR(dataframe, timeperiod=14)
        
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Conservative entry conditions:
        1. Strong uptrend: EMA fast > EMA slow
        2. Momentum pullback: RSI dips but not oversold
        3. Volume confirmation: Above average volume
        4. Volatility check: ATR not too extreme
        """
        dataframe.loc[
            (
                # Strong uptrend
                (dataframe["ema_fast"] > dataframe["ema_slow"]) &
                # Momentum pullback (dip but not oversold)
                (dataframe["rsi"] > self.rsi_entry.value) &
                (dataframe["rsi"] < 60) &
                # Volume confirmation
                (dataframe["volume_ratio"] > self.volume_factor.value) &
                # Reasonable volatility (not too flat, not too extreme)
                (dataframe["atr"] > dataframe["atr"].rolling(50).mean() * 0.3) &
                (dataframe["atr"] < dataframe["atr"].rolling(50).mean() * 2.0)
            ),
            "enter_long",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Conservative exit conditions:
        1. RSI overbought
        2. Trend reversal
        """
        dataframe.loc[
            (
                # RSI overbought
                (dataframe["rsi"] > self.rsi_exit.value) |
                # Trend reversal
                (dataframe["ema_fast"] < dataframe["ema_slow"])
            ),
            "exit_long",
        ] = 1

        return dataframe
