# Freqtrade Documentation Reference

This directory contains Freqtrade documentation as a reference for AI assistants and developers working on the fortiesr project.

## Purpose

These documentation files provide comprehensive information about Freqtrade configuration, strategy development, backtesting, and other key features. They serve as a reference for:

- AI assistants working on the project
- Developers implementing trading strategies
- Anyone needing quick access to Freqtrade documentation

## Documentation Files

### Core Configuration
- **configuration.md** - Complete configuration reference including all parameters, required fields, and best practices

### Strategy Development
- **strategy-101.md** - Quick start guide for strategy development, covering basic structure, indicators, signals, and simple examples

### Testing & Optimization
- **backtesting.md** - Backtesting guide including commands, result interpretation, and accuracy considerations
- **stoploss.md** - Stop loss configuration including static, trailing, and custom stop loss implementations

## Key Concepts

### Configuration
- config.json is the main configuration file
- Required parameters: max_open_trades, stake_currency, stake_amount, dry_run, minimal_roi, stoploss, exchange.name, strategy
- Supports JSON with comments (// and /* */)
- Can use multiple config files for secrets

### Strategies
- Python classes implementing IStrategy interface
- Key methods: populate_indicators, populate_entry_trend, populate_exit_trend
- Uses pandas dataframes with OHLCV data
- Supports both long and short trades

### Backtesting
- Tests strategies against historical data
- Requires downloaded historical data
- Provides detailed performance metrics
- Supports multiple strategy comparison

### Stop Loss
- Risk management tool
- Types: static, trailing, custom
- Can be on-exchange or bot-managed
- Supports leverage-aware calculations

## Quick Reference

### Common Commands

```bash
# Run bot in dry-run mode
freqtrade trade --config config.json

# Backtest a strategy
freqtrade backtesting --strategy MyStrategy

# Download historical data
freqtrade download-data --exchange binance --pairs BTC/USDT ETH/USDT

# Generate new config
freqtrade new-config --config user_data/config.json

# Plot backtesting results
freqtrade plot-dataframe
```

### Required Config Parameters

```json
{
    "max_open_trades": 3,
    "stake_currency": "USDT",
    "stake_amount": "unlimited",
    "dry_run": true,
    "minimal_roi": {"0": 0.10, "240": 0.05, "1440": 0.02},
    "stoploss": -0.10,
    "exchange": {"name": "binance"},
    "strategy": "MyStrategy"
}
```

## External Resources

- [Official Freqtrade Documentation](https://docs.freqtrade.io/)
- [Freqtrade GitHub Repository](https://github.com/freqtrade/freqtrade)
- [Freqtrade Example Strategies](https://github.com/freqtrade/freqtrade-strategies)
- [Freqtrade Discord](https://discord.gg/p7nuXxQ)

## Notes

- This documentation is based on the latest Freqtrade documentation
- Always refer to official docs for most up-to-date information
- Some advanced features may not be covered in detail here
- For production use, ensure proper security practices for API keys
