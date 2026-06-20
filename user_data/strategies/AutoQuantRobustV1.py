from freqtrade.strategy import IntParameter, DecimalParameter, IStrategy
from pandas import DataFrame
import talib.abstract as ta
from freqtrade.strategy import merge_informative_pair


class AutoQuantRobustV1(IStrategy):
    INTERFACE_VERSION: int = 3

    # ROI Table - realistic targets
    minimal_roi = {
        "0": 0.06,
        "30": 0.04,
        "60": 0.02,
        "120": 0.01,
        "240": 0,
    }

    # Stoploss - ATR-based will be calculated dynamically
    stoploss = -0.05

    # Timeframe
    timeframe = "1h"

    # Trailing stop
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.03
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
    rsi_oversold = IntParameter(25, 40, default=30, space="buy", optimize=True)
    rsi_overbought = IntParameter(60, 75, default=70, space="sell", optimize=True)
    
    # Volatility filter
    atr_period = IntParameter(10, 20, default=14, space="buy", optimize=True)
    atr_multiplier = DecimalParameter(1.0, 3.0, default=1.5, decimals=1, space="buy", optimize=True)
    
    # Volume filter
    volume_factor = DecimalParameter(0.8, 2.0, default=1.2, decimals=1, space="buy", optimize=True)
    
    # Stoploss parameters
    atr_stoploss_multiplier = DecimalParameter(1.5, 4.0, default=2.5, decimals=1, space="sell", optimize=True)
    
    # ROI parameters
    roi_0 = DecimalParameter(0.04, 0.10, default=0.06, decimals=3, space="sell", optimize=True)
    roi_30 = DecimalParameter(0.02, 0.06, default=0.04, decimals=3, space="sell", optimize=True)
    roi_60 = DecimalParameter(0.01, 0.03, default=0.02, decimals=3, space="sell", optimize=True)

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Trend indicators
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.ema_fast.value)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.ema_slow.value)
        
        # Momentum
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=self.rsi_period.value)
        
        # Volatility
        dataframe["atr"] = ta.ATR(dataframe, timeperiod=self.atr_period.value)
        
        # Volume
        dataframe["volume_mean"] = dataframe["volume"].rolling(window=20).mean()
        dataframe["volume_ratio"] = dataframe["volume"] / dataframe["volume_mean"]
        
        # MACD for additional confirmation
        macd = ta.MACD(dataframe, fastperiod=12, slowperiod=26, signalperiod=9)
        dataframe["macd"] = macd["macd"]
        dataframe["macd_signal"] = macd["macdsignal"]
        dataframe["macd_hist"] = macd["macdhist"]
        
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Entry conditions - long-only for better signal generation:
        1. Trend filter: EMA fast > EMA slow (uptrend for long)
        2. Momentum: RSI above midline
        3. Basic volume check
        """
        dataframe.loc[
            (
                # Trend filter - long in uptrend
                (dataframe["ema_fast"] > dataframe["ema_slow"]) &
                # Momentum - above midline
                (dataframe["rsi"] > 50) &
                # Basic volume check
                (dataframe["volume_ratio"] > 0.5)
            ),
            "enter_long",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """
        Exit conditions - long-only:
        1. RSI overbought (>70)
        2. Trend reversal (EMA fast < EMA slow)
        """
        dataframe.loc[
            (
                # RSI overbought
                (dataframe["rsi"] > 70) |
                # Trend reversal
                (dataframe["ema_fast"] < dataframe["ema_slow"])
            ),
            "exit_long",
        ] = 1

        return dataframe

    def custom_stoplevel(self, pair: str, current_rate: float, current_profit: float, 
                        entry_rate: float, current_time, dataframe: DataFrame, 
                        side: str, **kwargs) -> float:
        """
        Dynamic ATR-based stoploss
        """
        if len(dataframe) < self.atr_period.value:
            return self.stoploss
        
        atr_value = dataframe["atr"].iloc[-1]
        atr_multiplier = self.atr_stoploss_multiplier.value
        
        # Calculate ATR-based stoploss
        atr_stop = atr_value * atr_multiplier / entry_rate
        
        # Convert to percentage
        if side == "short":
            stoploss_pct = atr_stop
        else:
            stoploss_pct = -atr_stop
            
        # Ensure it's not too extreme
        stoploss_pct = max(min(stoploss_pct, -0.02), -0.15)
        
        return stoploss_pct

    def custom_roi(self, pair: str, current_profit: float, current_time, 
                   dataframe: DataFrame, trade, **kwargs) -> float | None:
        """
        Dynamic ROI based on optimizer parameters
        """
        roi_dict = {
            "0": self.roi_0.value,
            "30": self.roi_30.value,
            "60": self.roi_60.value,
            "120": 0.01,
            "240": 0,
        }
        
        # Find the appropriate ROI based on trade duration
        if trade:
            duration_minutes = (current_time - trade.open_date_utc).total_seconds() / 60
            
            for minutes, roi in sorted(roi_dict.items()):
                if duration_minutes <= int(minutes):
                    return roi
                    
        return None
