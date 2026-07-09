# Plugins, Protections, and Pairlists — Extending Freqtrade

Freqtrade is modular. You can extend its behavior without changing the core code. There are three main extension types:

1. **Pairlist Handlers** — define which pairs the bot can trade
2. **Protections** — automatically lock pairs or the whole bot under bad conditions
3. **Order Types / Protections / Filters** — further trade rules

---

## Pairlist Handlers

Pairlists control which pairs are active. They are configured in `config.json` under `pairlists`.

### StaticPairList (default)

A fixed list. Best for backtesting because it is deterministic.

```json
"pairlists": [
    {"method": "StaticPairList"}
]
```

Pair selection:
- `exchange.pair_whitelist` — allowed pairs
- `exchange.pair_blacklist` — blocked pairs
- Both support regex, e.g. `".*/USDT"` means all USDT pairs

### VolumePairList

Sorts pairs by 24h volume and keeps the top N.

```json
"pairlists": [
    {
        "method": "VolumePairList",
        "number_assets": 20,
        "sort_key": "quoteVolume",
        "refresh_period": 1800,
        "min_value": 0
    }
]
```

Advanced mode uses candle history instead of 24h ticker:
```json
"lookback_days": 7
```

### PercentChangePairList

Sorts by recent price change. Useful for trending/momentum pair selection.

### Filters

Applied **after** the pairlist source. They remove pairs that do not meet conditions:

| Filter | What it does |
|--------|--------------|
| `AgeFilter` | Removes pairs younger than N days |
| `DelistFilter` | Removes recently delisted pairs |
| `PrecisionFilter` | Removes pairs with bad price precision |
| `PriceFilter` | Removes pairs outside min/max price |
| `SpreadFilter` | Removes pairs with huge bid-ask spread |
| `VolatilityFilter` | Removes pairs with abnormal volatility |
| `ShuffleFilter` | Randomizes pair order |
| `RangeStabilityFilter` | Removes pairs with unusual stability range |
| `PerformanceFilter` | Removes under-performing pairs (needs trade history) |

Pairlist configuration example:

```json
"pairlists": [
    {"method": "VolumePairList", "number_assets": 30},
    {"method": "AgeFilter", "min_days_listed": 30},
    {"method": "SpamFilter", "low_amount": 0.001},
    {"method": "PriceFilter", "min_price": 0.00001},
    {"method": "ShuffleFilter", "seed": 42}
]
```

Pairlists run in sequence. Output of one is input to the next.

---

## Protections

Protections stop trading under certain conditions. They can lock:

- **One pair** — after a bad trade, cooldown, etc.
- **All pairs** — if overall drawdown is too high, too many losses, etc.

Protections run **before** checking entry signals. If a protection is active, no new trades will open for that pair/globally.

### Built-in Protections

| Protection | What it does |
|------------|--------------|
| `CooldownPeriod` | Lock pair for N minutes/candles after exit |
| `MaxDrawdown` | Lock all pairs if drawdown exceeds threshold |
| `StoplossGuard` | Lock pairs if too many stoploss events in a window |
| `LowProfitPairs` | Lock pairs if recent trades were unprofitable |
| `LookaheadBias` | Experimental protection against time-travel bugs |

### Example Protections

```python
@property
def protections(self):
    return [
        {
            "method": "CooldownPeriod",
            "stop_duration_candles": 5
        },
        {
            "method": "MaxDrawdown",
            "lookback_period_candles": 48,
            "trade_limit": 20,
            "stop_duration_candles": 4,
            "max_allowed_drawdown": 0.2
        },
        {
            "method": "StoplossGuard",
            "lookback_period_candles": 24,
            "trade_limit": 4,
            "stop_duration_candles": 2,
            "only_per_pair": False
        },
        {
            "method": "LowProfitPairs",
            "lookback_period_candles": 6,
            "trade_limit": 2,
            "stop_duration": 60,
            "required_profit": 0.02
        }
    ]
```

Protections are evaluated in order. If one triggers, the rest are still checked.

---

## Best Pairlist + Protection Setup for Testing

For initial testing, use the simplest setup:

```json
"pairlists": [
    {"method": "StaticPairList"}
],
"pair_whitelist": [
    "BTC/USDT",
    "ETH/USDT",
    "BNB/USDT"
],
"protections": [
    {
        "method": "CooldownPeriod",
        "stop_duration_candles": 5
    }
]
```

This gives you:
- Predictable pairs (no dynamic filters introducing bias)
- Basic cooldown so pairs do not re-enter immediately after exit

Once the strategy is stable in backtest, you can gradually add VolumePairList and more protections.

---

## Important Notes

- Protections require state: `LowProfitPairs`, `MaxDrawdown`, and `StoplossGuard` need trade history. In backtest, they are only evaluated when `--enable-protections` is passed.
- `Stoploss on exchange` only works on some exchanges. Check the exchange notes.
- Do not use too many protections too early. They can mask a bad strategy by hiding losses instead of fixing them.

Sources:
- https://www.freqtrade.io/en/stable/plugins/
- https://www.freqtrade.io/en/stable/stoploss/
