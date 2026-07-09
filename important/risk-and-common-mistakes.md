# Risk, Guardrails, and Common Mistakes

This file is for honest reality checks. Crypto trading can lose money. Do not skip this.

---

## Hard Rules Before Any Live Trading

1. **Never use more than you can afford to lose.**
2. **Start with dry-run only.** Prove the strategy works over long history and in dry-run first.
3. **Always use stoploss.** Never run a strategy without stoploss.
4. **Small position sizes** until you have confidence in the strategy.
5. **No real money** until you have at least a few months of dry-run data and the results are consistently positive.
6. **Understand the strategy before running it.** Do not run strategies you have not inspected.

---

## Common Ways People Lose Money With Freqtrade

### 1. Running Without Understanding the Strategy

Many public strategies fail badly in live markets. They were overfit to specific historical periods or pairs. Always read the strategy code. Check stoploss, ROI, and exits.

### 2. Using Too Wide Stoploss

A 20-30% stoploss means one bad trade destroys your entire capital base. Good rule of thumb: keep stoploss under 10% on spot, even smaller on leverage.

### 3. Running Too Many Pairs

More pairs = more diversification, but also more slippage, more processing delay, more fee drag. Start with 3-5 pairs you understand.

### 4. Overfitting via Hyperopt

Hyperopt can find parameters that work perfectly on your specific historical data but fail everywhere else. Signs of overfitting:
- Very few trades
- Perfect backtest win rate
- Results completely change with a different timerange
- Very large stoploss hiding poor entries

### 5. Ignoring Dry-Run Results

If backtest shows +100% but dry-run shows -20%, the backtest was misleading. Do not ignore this gap. It means the backtest assumptions are unrealistic for your setup.

### 6. Trading Without Protections

Freqtrade can keep buying the same pair after losses. Add `CooldownPeriod` at minimum. Consider `StoplossGuard` to stop if too many stoplosses fire in a short period.

### 7. Using Limit Orders Without Volume

In live mode, limit orders might never fill. Backtesting assumes they fill. Use market orders for testing, or understand the liquidity of your pairs.

### 8. Not Accounting for Fees

High-frequency strategies on small timeframes die from fees. Always calculate: fees eat how much of your profit per trade?

### 9. Underestimating Market Regime Changes

A strategy that works in a bull market might fail in a bear market. Validate across:
- Different time periods
- Bull and bear conditions
- Multiple pairs

### 10. Forgetting That Past Performance Is Not Future Results

This is the most important. Backtesting and even dry-run do not guarantee future profits. They only show what would have happened.

---

## Stoploss — What Is Safe

| Market type | Recommended stoploss range |
|-------------|---------------------------|
| Spot BTC/ETH | -5% to -10% |
| Spot altcoins | -5% to -15% |
| Futures (2-3x) | -2% to -5% |
| Futures (5-10x) | -1% to -3% |

Higher leverage = tighter stoploss. Otherwise normal market noise will hit stop and reverse.

---

## Position Size — What Is Safe

A common rule in trading: risk no more than 1-2% of your total capital on a single trade.

With freqtrade, you can enforce this via `custom_stake_amount()` based on stoploss and account balance.

---

## What to Check Before Promoting Strategy to Live

- [ ] Code reviewed — you understand every indicator and every exit condition
- [ ] Stoploss under 15% on spot
- [ ] At least 30-50 trades in backtest
- [ ] Backtest profit and dry-run profit are within reasonable range
- [ ] Positive performance across at least 3 pairs
- [ ] No lookahead bias (lookahead-analysis clean)
- [ ] No recursive issues (recursive-analysis clean)
- [ ] Drawdown below 25%
- [ ] Profit factor above 1.3
- [ ] Win rate and average win vs average loss are sensible
- [ ] Protections configured
- [ ] Dry-run for at least 2-4 weeks with good results before going live

---

## Red Flags in Strategy Code

If you see any of these in a strategy, treat it as suspicious until proven otherwise:

- Stoploss greater than 0.20 (20%)
- ROI table where later values are higher than earlier values
- Very few trades (under 20 in a year of data)
- No stoploss or ROI at all
- Posting `print()` statements instead of proper logging
- Indicators created inside entry/exit functions, not populate_indicators
- Use of `.iloc[-1]` or `shift(-1)` in populate functions
- Very large moving average periods (> 200 candles) on short timeframes

---

## Crypto-Specific Risks

- **24/7 market** — no opening/closing bells. Strategies that ignore gaps or flash crashes are dangerous.
- **Volatility** — 10-20% intraday moves are normal for altcoins.
- **Liquidity** — low-volume pairs have slippage that backtests hide.
- **Regulatory risk** — exchanges can change rules, delist pairs.
- **Exchange failure** — do not keep all funds on the exchange.

---

## Never Ever

- Do not use money you need for rent, bills, or emergencies.
- Do not borrow money to trade.
- Do not chase losses by increasing stake amount.
- Do not turn on live mode because you are desperate for profits when down.
- Do not believe anyone who promises guaranteed returns.

---

Remember: the goal is not to get rich quick. The goal is to build a strategy that is **reliably profitable over the long term**, with controlled risk.

One good strategy with proper risk management beats 100 desperate trades every time.

Sources:
- https://www.freqtrade.io/en/stable/installation/
- https://www.freqtrade.io/en/stable/backtesting/
- https://www.freqtrade.io/en/stable/strategy-customization/#common-mistakes-when-developing-strategies
