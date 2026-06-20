from freqtrade.strategy import IStrategy, IntParameter, DecimalParameter
from pandas import DataFrame
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class AutoQuantRobustV4(IStrategy):
    """
    AutoQuantRobustV4 - A robust trend-following strategy with multiple filters.
    
    Strategy Logic:
    1. Trend Filter: EMA trend direction (200 EMA)
    2. Momentum Confirmation: RSI overbought/oversold + MACD crossover
    3. Volatility Filter: ATR-based volatility check
    4. Volume Filter: Volume spike confirmation
    5. Risk Control: ATR-based dynamic stoploss
    
    This strategy is designed to avoid overfitting by using proven indicators
    with sensible default ranges for optimization.
    """
    
    INTERFACE_VERSION: int = 3
    
    # ROI Table - realistic profit targets
    minimal_roi = {
        "0": 0.06,   # 6% profit target immediately
        "60": 0.04,  # 4% after 1 hour
        "240": 0.02, # 2% after 4 hours
        "720": 0.01, # 1% after 12 hours
        "1440": 0,   # exit after 24 hours if not stopped
    }
    
    # Stoploss - ATR-based will be calculated dynamically
    stoploss = -0.10  # 10% default, will be adjusted by ATR
    
    # Timeframe - 1h for good balance of signal frequency and noise reduction
    timeframe = "1h"
    
    # Trailing stop - enabled for trend-following
    trailing_stop = True
    trailing_stop_positive = 0.015  # 1.5% trailing stop when in profit
    trailing_stop_positive_offset = 0.025  # Activate trailing stop at 2.5% profit
    trailing_only_offset_is_reached = True
    
    # Process only new candles for efficiency
    process_only_new_candles = True
    startup_candle_count = 200  # Need enough data for indicators
    
    # Can short - disabled for simplicity and risk management
    can_short = False
    
    # ── Tunable Parameters for Optimizer ──
    
    # Trend Filter Parameters
    trend_ema_period = IntParameter(100, 200, default=200, space="buy", optimize=True)
    
    # Momentum Parameters  
    rsi_period = IntParameter(10, 20, default=14, space="buy", optimize=True)
    rsi_oversold = IntParameter(20, 35, default=30, space="buy", optimize=True)
    rsi_overbought = IntParameter(65, 80, default=70, space="sell", optimize=True)
    
    macd_fast = IntParameter(8, 15, default=12, space="buy", optimize=True)
    macd_slow = IntParameter(20, 30, default=26, space="buy", optimize=True)
    macd_signal = IntParameter(5, 10, default=9, space="buy", optimize=True)
    
    # Volatility Filter Parameters
    atr_period = IntParameter(10, 20, default=14, space="buy", optimize=True)
    atr_multiplier = DecimalParameter(1.0, 3.0, default=1.5, decimals=1, space="buy", optimize=True)
    
    # Volume Filter Parameters
    volume_multiplier = DecimalParameter(1.0, 3.0, default=1.5, decimals=1, space="buy", optimize=True)
    volume_period = IntParameter(15, 30, default=20, space="buy", optimize=True)
    
    # Stoploss Parameters
    atr_stoploss_multiplier = DecimalParameter(1.5, 3.0, default=2.0, decimals=1, space="stoploss", optimize=True)
    
    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Calculate all indicators needed for the strategy.
        """
        
        # Trend Filter - EMA
        dataframe["ema_trend"] = ta.EMA(dataframe, timeperiod=self.trend_ema_period.value)
        
        # Momentum Indicators
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=self.rsi_period.value)
        
        macd = ta.MACD(dataframe, fastperiod=self.macd_fast.value, 
                       slowperiod=self.macd_slow.value, 
                       signalperiod=self.macd_signal.value)
        dataframe["macd"] = macd["macd"]
        dataframe["macd_signal"] = macd["macdsignal"]
        dataframe["macd_hist"] = macd["macdhist"]
        
        # Volatility Indicator - ATR
        dataframe["atr"] = ta.ATR(dataframe, timeperiod=self.atr_period.value)
        
        # Volume Indicator
        dataframe["volume_mean"] = dataframe["volume"].rolling(window=self.volume_period.value).mean()
        dataframe["volume_ratio"] = dataframe["volume"] / dataframe["volume_mean"]
        
        # Dynamic ATR-based stoploss
        dataframe["atr_stoploss"] = dataframe["atr"] * self.atr_stoploss_multiplier.value
        
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Entry conditions with multiple filters for robustness.
        """
        # Condition 1: Trend Filter - Price above long-term EMA (uptrend)
        trend_up = dataframe["close"] > dataframe["ema_trend"]
        
        # Condition 2: Momentum - RSI oversold (buying opportunity)
        rsi_oversold = dataframe["rsi"] < self.rsi_oversold.value
        
        # Condition 3: Momentum - MACD crossover (bullish signal)
        macd_bullish = (
            (dataframe["macd"] > dataframe["macd_signal"]) &  # MACD above signal
            (dataframe["macd_hist"] > 0)  # Positive histogram
        )
        
        # Condition 4: Volatility Filter - Not extremely volatile (avoid panic buys)
        volatility_ok = dataframe["atr"] < (dataframe["close"] * 0.05)  # ATR less than 5% of price
        
        # Condition 5: Volume Filter - Volume spike (confirmation)
        volume_spike = dataframe["volume_ratio"] > self.volume_multiplier.value
        
        # Combine all conditions
        dataframe.loc[
            trend_up & 
            rsi_oversold & 
            macd_bullish & 
            volatility_ok & 
            volume_spike,
            "enter_long"
        ] = 1
        
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Exit conditions with proper profit taking and loss cutting.
        """
        # Condition 1: Momentum - RSI overbought (take profit)
        rsi_overbought = dataframe["rsi"] > self.rsi_overbought.value
        
        # Condition 2: Momentum - MACD bearish crossover (exit signal)
        macd_bearish = (
            (dataframe["macd"] < dataframe["macd_signal"]) &  # MACD below signal
            (dataframe["macd_hist"] < 0)  # Negative histogram
        )
        
        # Condition 3: Trend Break - Price below trend EMA
        trend_break = dataframe["close"] < dataframe["ema_trend"]
        
        # Combine exit conditions (any one triggers exit)
        dataframe.loc[
            rsi_overbought | 
            macd_bearish | 
            trend_break,
            "exit_long"
        ] = 1
        
        return dataframe

    def custom_stoploss(self, pair: str, trade, current_time, current_rate, 
                        current_profit, **kwargs) -> float:
        """
        Custom ATR-based stoploss for dynamic risk management.
        """
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        last_candle = dataframe.iloc[-1].squeeze()
        
        # Use ATR-based stoploss if available, otherwise use default
        if "atr_stoploss" in last_candle and not last_candle["atr_stoploss"] == 0:
            atr_stop = -(last_candle["atr_stoploss"] / last_candle["close"])
            # Use the wider of default stoploss and ATR stoploss
            return max(self.stoploss, atr_stop)
        
        return self.stoploss
