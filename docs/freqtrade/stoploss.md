# Stop Loss

Stop loss is a risk management tool that automatically exits a trade when the price moves against you beyond a certain threshold.

## Stop Loss On-Exchange/Freqtrade

Freqtrade supports stop loss on exchange, which means the stop loss order is placed directly on the exchange rather than being managed by the bot.

### Which order type is used for stoploss on exchange?

The order type used for stoploss on exchange depends on the exchange and the configuration. Common order types include:
- Market orders
- Limit orders
- Stop-limit orders

### Which order type should I use for stoploss on exchange?

The choice depends on your trading style and risk tolerance:
- **Market orders**: Guaranteed execution but may experience slippage
- **Limit orders**: Price control but may not execute if price moves quickly
- **Stop-limit orders**: Combination of stop and limit orders

### stoploss_on_exchange and stoploss_on_exchange_limit_ratio

- `stoploss_on_exchange`: Enable stop loss on exchange (true/false)
- `stoploss_on_exchange_limit_ratio`: Ratio for limit orders when using stop loss on exchange

Example configuration:
```json
"stoploss_on_exchange": true,
"stoploss_on_exchange_limit_ratio": 0.99
```

### stoploss_on_exchange_interval

The interval at which the bot checks and updates stop loss orders on the exchange.

```json
"stoploss_on_exchange_interval": 60
```

### stoploss_price_type

The method used to calculate the stop loss price:
- `standard`: Standard stop loss calculation
- `last`: Based on last price
- `mark`: Based on mark price (for futures)

### force_exit

Force exit all trades immediately. This is useful in emergency situations.

### force_entry

Force entry even if entry conditions are not met.

### emergency_exit

Emergency exit mode that exits all trades regardless of conditions.

## Stop Loss Types

At this stage the bot contains the following stoploss support modes:

1. Static stop loss
2. Trailing stop loss
3. Trailing stop loss, custom positive loss
4. Trailing stop loss only once the trade has reached a certain offset
5. Custom stoploss function

### Static Stop Loss

A static stop loss sets a fixed percentage below the entry price. If the price drops below this level, the trade is exited.

```json
"stoploss": -0.10
```

This sets a 10% stop loss.

### Trailing Stop Loss

A trailing stop loss adjusts as the price moves in your favor, locking in profits while still protecting against reversals.

```json
"trailing_stop": true,
"trailing_stop_positive": 0.01,
"trailing_stop_positive_offset": 0.02
```

This means:
- Enable trailing stop
- Trail at 1% below the highest price reached
- Only start trailing after 2% profit

### Trailing stop loss, different positive loss

You can set different trailing stop values for different profit levels.

```json
"trailing_stop": true,
"trailing_stop_positive": 0.005,
"trailing_stop_positive_offset": 0.01,
"trailing_only_offset_is_reached": true
```

### Trailing stop loss only once the trade has reached a certain offset

You can configure the trailing stop to only activate after a certain profit threshold is reached.

```json
"trailing_stop": true,
"trailing_stop_positive": 0.01,
"trailing_stop_positive_offset": 0.05,
"trailing_only_offset_is_reached": true
```

This means:
- Enable trailing stop
- Trail at 1% below highest price
- Only start trailing after 5% profit is reached

### Custom stoploss function

You can implement a custom stoploss function in your strategy for advanced stop loss logic.

```python
def custom_stoploss(self, pair: str, trade: Trade, current_time: datetime,
                    current_rate: float, current_profit: float, **kwargs) -> float:
    # Custom stoploss logic
    return -0.05
```

## Stoploss and Leverage

When using leverage, stop loss calculations need to account for the increased risk. The stop loss percentage should be adjusted based on your leverage level.

## Changing stoploss on open trades

You can change the stop loss on open trades manually or through the API.

### Limitations

- Some exchanges may not support modifying stop loss orders
- Changes may not be immediate
- Rate limits may apply

## Example Configurations

### Basic static stop loss
```json
{
    "stoploss": -0.10
}
```

### Trailing stop loss
```json
{
    "stoploss": -0.05,
    "trailing_stop": true,
    "trailing_stop_positive": 0.01,
    "trailing_stop_positive_offset": 0.02
}
```

### Stop loss on exchange
```json
{
    "stoploss": -0.10,
    "stoploss_on_exchange": true,
    "stoploss_on_exchange_interval": 60
}
```

### Advanced trailing stop
```json
{
    "stoploss": -0.05,
    "trailing_stop": true,
    "trailing_stop_positive": 0.005,
    "trailing_stop_positive_offset": 0.01,
    "trailing_only_offset_is_reached": true
}
```
