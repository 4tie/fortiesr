# AIStrategy — Current State Analysis

Path: `user_data/strategies/AIStrategy.py`

This is a **Multi-Moving-Average** strategy. It is based on the idea that when short-period TEMA is below longer-period TEMA, the trend is going down. When it crosses above, entry may be valid.

But looking at this strategy carefully, there are **structural problems** you should know before running it.

---

## What It Does

### Indicators

- Uses `TEMA` (Triple Exponential Moving Average).
- Creates many TEMA lines by multiplying `buy_ma_count * buy_ma_gap` and `sell_ma_count * sell_ma_gap`.
- For current hyperopted values:
  - Buy periods: 95, 190, ... up to ~855
  - Sell periods: 54, 108, ... up to ~918

### Entry Signal

Entry (`enter_long`) fires when **all** short TEMA lines are **below** longer TEMA lines:

```python
dataframe[key] < dataframe[past_key]
```

AND-ed across all generated periods. This means: lower TEMA < higher TEMA → downtrend detected → long entry.

### Exit Signal

Exit (`exit_long`) fires when **any** sell TEMA is above the previous longer one:

```python
dataframe[key] > dataframe[past_key]
```

OR-ed across periods. This is an **asymmetric** condition.

---

## Problems

### 1. Entry and Exit Are Weakly Related

- Entry requires ALL buy conditions to be true at once.
- Exit requires ANY sell condition to be true.

This mismatch creates **very rare exits** and **very rare entries**. You might hold losing trades for a long time.

### 2. TEMA Periods Are Very Large

With default values `buy_ma_count=18, buy_ma_gap=95`:
- Largest buy TEMA period = 18 * 95 = 1710 candles
- At 5m timeframe: 1710 candles = ~142 hours = ~6 days

This is nearly a weekly indicator on a 5-minute chart. Signals will be extremely rare.

### 3. Stop Loss Is Very Wide

```python
stoploss = -0.336   # 33.6% max loss per trade
```

A 33.6% stoploss is extremely dangerous. In crypto, that means the price must drop more than one-third before the bot exits. One bad trade can erase many winners.

### 4. ROI Table Has Back-to-Front Values

```python
minimal_roi = {
    "0": 0.192,      # +19.2% after 0 minutes
    "12": 0.061,     # +6.1% after 12 minutes
    "33": 0.017,     # +1.7% after 33 minutes
    "145": 0.0,      # 0% after 145 minutes
    "1553": 0.123,   # +12.3% after 1553 minutes (26 hours)
    "2332": 0.076,   # +7.6% after 2332 minutes (39 hours)
    "3169": 0        # 0% after 3169 minutes (53 hours)
}
```

This ROI table is confusing. After 145 minutes the bot wants 0% profit, but at 1553 minutes it raises back to 12.3%? This is almost certainly **overfitting or an error from hyperopt search**.

### 5. Trailing Stop Is Disabled

```python
trailing_stop = False
```

With such a wide fixed stoploss and a strange ROI table, the strategy has no adaptive risk management.

### 6. No Protections

No `@property def protections():` defined. The bot will keep trading even after many losses.

---

## What This Means in Practice

- The strategy is trying to trade multi-week trend direction on a 5-minute chart.
- It likely generates very few trades, so backtest results can look good with one or two lucky catches.
- The 33.6% stoploss is a major risk: one bad trade can wipe out many small gains.
- The ROI table suggests this was optimized overfit to a specific historical period.

---

## How to Improve It

Before touching the code, think in this order:

1. **Switch to logical stoploss** — aim for 3-10% on spot, much less on leverage.
2. **Fix ROI table** — should always decrease over time: bigger profit target early, smaller later, never go up again after 0%.
3. **Enable protections** — at minimum `CooldownPeriod` to avoid re-entry after loss.
4. **Reduce indicator count** — fewer, clearer moving averages.
5. **Consider simpler logic** — RSI + EMA crossover, MACD, Bollinger Bands, etc. Much easier to validate.
6. **Always validate with lookahead-analysis and recursive-analysis** before dry-run.

---

## Bottom Line

This strategy is **not production-ready**. The stoploss and ROI table make it dangerous to run live, even in dry-run mode it is likely producing misleading results because of low trade count + wide stoploss.

Treat it as a hyperopt-experiment result, not a finished strategy.

Sources:
- https://www.freqtrade.io/en/stable/strategy-customization/
- https://www.freqtrade.io/en/stable/stoploss/
- https://www.freqtrade.io/en/stable/plugins/ (protections)
