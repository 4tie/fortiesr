from freqtrade.strategy import IntParameter, IStrategy
from pandas import DataFrame
from datetime import datetime
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib
from functools import reduce
import pandas as pd

class AIStrategy_Optimized(IStrategy):
    atr_dict = {'ARB/USDT': 0.01, 'FIL/USDT': 0.01, 'MANA/USDT': 0.01}
    stability_dict = {'ARB/USDT': 100.0, 'FIL/USDT': 100.0, 'MANA/USDT': 100.0}

    def confirm_trade_entry(self, pair: str, order_type: str, rate: float, time_in_force: str, current_time: datetime, entry_tag: str | None, side: str, **kwargs) -> bool:
        """Risk guard: prevent over-trading and excessive drawdown."""
        open_trades = len(self.trade_handler.order_open_trades)
        max_open_trades = 5
        if open_trades >= max_open_trades:
            return False
        return True

    def custom_stoploss(self, pair: str, trade, current_time, current_rate: float, current_profit: float, after_fill: bool, **kwargs) -> float | None:
        """Three-tier aggressive trailing stoploss with profit lock-in.
        
        Tier 1: If profit >= 2%, lock stoploss at +0.5%
        Tier 2: If profit >= 4%, lock stoploss at +1.5%
        Tier 3: If profit >= 8%, lock stoploss at +3.0%
        """
        from freqtrade.strategy import stoploss_from_open
        if current_profit >= 0.08:
            return stoploss_from_open(0.03, current_profit, is_short=trade.is_short, leverage=trade.leverage) or 1
        if current_profit >= 0.04:
            return stoploss_from_open(0.015, current_profit, is_short=trade.is_short, leverage=trade.leverage) or 1
        if current_profit >= 0.02:
            return stoploss_from_open(0.005, current_profit, is_short=trade.is_short, leverage=trade.leverage) or 1
        return None
    INTERFACE_VERSION: int = 3
    buy_params = {'buy_ma_count': 4, 'buy_ma_gap': 15}
    sell_params = {'sell_ma_count': 12, 'sell_ma_gap': 68}
    minimal_roi = {'0': 0.523, '1553': 0.123, '2332': 0.076, '3169': 0.0}
    stoploss = -0.3
    trailing_stop = False
    trailing_stop_positive = None
    trailing_stop_positive_offset = 0.0
    trailing_only_offset_is_reached = False
    timeframe = '5m'
    count_max = 20
    gap_max = 100
    buy_ma_count = IntParameter(1, count_max, default=4, space='buy')
    buy_ma_gap = IntParameter(1, gap_max, default=15, space='buy')
    sell_ma_count = IntParameter(1, count_max, default=12, space='sell')
    sell_ma_gap = IntParameter(1, gap_max, default=68, space='sell')

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        periods = set()
        for ma_count in range(1, int(self.buy_ma_count.value)):
            periods.add(ma_count * int(self.buy_ma_gap.value))
        for ma_count in range(1, int(self.sell_ma_count.value)):
            periods.add(ma_count * int(self.sell_ma_gap.value))
        periods = sorted([p for p in periods if p > 1])
        new_cols = {}
        for p in periods:
            if p not in dataframe.columns:
                new_cols[p] = ta.TEMA(dataframe, timeperiod=int(p))
        if new_cols:
            dataframe = pd.concat([dataframe, pd.DataFrame(new_cols)], axis=1)
        print(' ', metadata['pair'], end='\t\r')
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        conditions = []
        for ma_count in range(self.buy_ma_count.value):
            key = ma_count * self.buy_ma_gap.value
            past_key = (ma_count - 1) * self.buy_ma_gap.value
            if past_key > 1 and key in dataframe.keys() and (past_key in dataframe.keys()):
                conditions.append(dataframe[key] < dataframe[past_key])
        if conditions:
            dataframe.loc[reduce(lambda x, y: x & y, conditions), 'enter_long'] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        conditions = []
        for ma_count in range(self.sell_ma_count.value):
            key = ma_count * self.sell_ma_gap.value
            past_key = (ma_count - 1) * self.sell_ma_gap.value
            if past_key > 1 and key in dataframe.keys() and (past_key in dataframe.keys()):
                conditions.append(dataframe[key] > dataframe[past_key])
        if conditions:
            dataframe.loc[reduce(lambda x, y: x | y, conditions), 'exit_long'] = 1
        return dataframe

    def custom_stake_amount(self, pair: str, current_time, current_rate: float, proposed_stake: float, min_stake: float | None, max_stake: float, leverage: float, entry_tag: str | None, side: str, **kwargs) -> float:
        """Calculate position size based on ATR and stability score for dual-factor sizing.
        
        Formula: position_size = proposed_stake * (target_risk_pct / (atr / current_rate)) * (stability_score / 100)
        
        This method implements production-grade edge-case guards to prevent exchange execution errors:
        - Division-by-zero guard for ATR and current_rate
        - KeyError guard using .get() for dictionary access
        - Zero-stability fallback to min_stake
        """
        target_risk_pct = 0.02
        atr = self.atr_dict.get(pair, current_rate * 0.02)
        if atr <= 0 or current_rate <= 0:
            return min_stake if min_stake is not None else proposed_stake
        atr_pct = atr / current_rate
        if atr_pct <= 0:
            return min_stake if min_stake is not None else proposed_stake
        stability_score = self.stability_dict.get(pair, 50.0)
        position_size = proposed_stake * (target_risk_pct / atr_pct) * (stability_score / 100.0)