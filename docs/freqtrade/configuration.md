# Freqtrade Configuration Documentation

## The Freqtrade configuration file

The bot uses a set of configuration parameters during its operation that all together conform to the bot configuration. It normally reads its configuration from a file (Freqtrade configuration file).

Per default, the bot loads the configuration from the `config.json` file, located in the current working directory.

You can specify a different configuration file used by the bot with the `-c/--config` command-line option.

If you used the Quick start method for installing the bot, the installation script should have already created the default configuration file (`config.json`) for you.

If the default configuration file is not created we recommend using `freqtrade new-config --config user_data/config.json` to generate a basic configuration file.

The Freqtrade configuration file is to be written in JSON format.

Additionally to the standard JSON syntax, you may use one-line `// ...` and multi-line `/* ... */` comments in your configuration files and trailing commas in the lists of parameters.

Do not worry if you are not familiar with JSON format -- simply open the configuration file with an editor of your choice, make some changes to the parameters you need, save your changes, and, finally, restart the bot or, if it was previously stopped, run it again with the changes you made to the configuration. The bot validates the syntax of the configuration file at startup and will warn you if you made any errors editing it, pointing out problematic lines.

## Environment variables

Environment variables are loaded after the initial configuration. As such, you cannot provide the path to the configuration through environment variables. Please use `--config path/to/config.json` for that. This also applies to `user_dir` to some degree. while the user directory can be set through environment variables - the configuration will **not** be loaded from that location.

## Multiple configuration files

Additional config files. These files will be loaded and merged with the config file. The files are resolved relative to the initial file. Defaults to []. Datatype: List of strings

## Editor autocomplete and validation

If you are using an editor that supports JSON schema, you can use the schema provided by Freqtrade to get autocompletion and validation of your configuration file by adding the following line to the `config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/freqtrade/freqtrade/develop/docs/freqtrade.schema.json"
}
```

## Configuration parameters

Mandatory parameters are marked as Required, which means that they are required to be set in one of the possible ways.

### Required Parameters

- **max_open_trades** (Required): Number of open trades your bot is allowed to have. Only one open trade per pair is possible, so the length of your pairlist is another limitation that can apply. If -1 then it is ignored (i.e. potentially unlimited open trades, limited by the pairlist). Strategy Override. Datatype: Positive integer or -1.

- **stake_currency**: The crypto-currency used for trading. Defaults to "USDT". Datatype: String.

- **stake_amount** (Required): Amount of crypto-currency your bot will use for each trade. Set it to "unlimited" to allow the bot to use all available balance. Datatype: Positive float or "unlimited".

- **tradable_balance_ratio**: Ratio of the total account balance the bot is allowed to trade. More information below. Defaults to 0.99 (99%). Datatype: Float (as ratio). Must be > 0 and <= 1.

- **timeframe**: The timeframe to use (e.g 1m, 5m, 15m, 30m, 1h ...). Usually missing in configuration, and specified in the strategy. Strategy Override. Datatype: String.

- **fiat_display_currency**: Fiat currency used to show your profits. More information below. Datatype: String.

- **dry_run** (Required): Define if the bot must be in Dry Run or production mode. Defaults to true. Datatype: Boolean.

- **minimal_roi** (Required): Set the threshold as ratio the bot will use to exit a trade. More information below. Strategy Override. Datatype: Dict.

- **stoploss** (Required): Set the stoploss used by the bot. Strategy Override. Datatype: Float (as ratio).

- **exchange.name** (Required): Exchange class to use. Datatype: String.

- **exchange.key**: API key to use for the exchange. Only required when you are in production mode. Keep it in secret, do not disclose publicly. Datatype: String.

- **exchange.secret**: API secret to use for the exchange. Only required when you are in production mode. Keep it in secret, do not disclose publicly. Datatype: String.

- **strategy** (Required): Defines Strategy class to use. Recommended to be set via --strategy NAME. Datatype: ClassName.

### Optional Parameters

- **dry_run_wallet**: Define the starting amount in stake currency for the simulated wallet used by the bot running in Dry Run mode. More information below. Defaults to 1000. Datatype: Float or Dict.

- **cancel_open_orders_on_exit**: Cancel open orders on /stop or Ctrl+C. Defaults to true. Datatype: Boolean.

- **process_only_new_candles**: Only process new candles during dry-run. Strategy Override. Defaults to true. Datatype: Boolean.

- **trading_mode**: Trading mode to use. Defaults to "spot". See leverage documentation. Datatype: String.

- **margin_mode**: Margin mode to use. See leverage documentation. Datatype: String.

- **unfilledtimeout.entry**: Timeout for entry orders. Strategy Override. Datatype: Integer.

- **unfilledtimeout.exit**: Timeout for exit orders. Strategy Override. Datatype: Integer.

- **unfilledtimeout.unit**: Unit for unfilledtimeout. Defaults to "minutes". Strategy Override. Datatype: String.

- **unfilledtimeout.exit_timeout_count**: Number of retries for exit orders. Strategy Override. Defaults to 0. Datatype: Integer.

- **entry_pricing.price_side**: Price side for entry orders. Defaults to "same". More information below. Datatype: String ("ask", "bid", "same", "other").

- **entry_pricing.price_last_balance**: Price last balance. More information below. Datatype: Float.

- **entry_pricing.use_order_book**: Use order book for entry pricing. Defaults to true. Datatype: Boolean.

- **entry_pricing.order_book_top**: Order book top for entry pricing. Defaults to 1. Datatype: Integer.

- **entry_pricing.check_depth_of_market.enabled**: Check market depth. Defaults to false. Datatype: Boolean.

- **entry_pricing.check_depth_of_market.bids_to_ask_delta**: Bids to ask delta for market depth check. Defaults to 0. Datatype: Float.

- **exit_pricing.price_side**: Price side for exit orders. Defaults to "same". More information below. Datatype: String ("ask", "bid", "same", "other").

- **exit_pricing.price_last_balance**: Price last balance. More information below. Datatype: Float.

- **exit_pricing.use_order_book**: Use order book for exit pricing. Defaults to true. Datatype: Boolean.

- **exit_pricing.order_book_top**: Order book top for exit pricing. Defaults to 1. Datatype: Integer.

- **custom_price_max_distance_ratio**: Custom price max distance ratio. Defaults to 0.02. Datatype: Float.

- **use_exit_signal**: Use exit signal instead of minimal_roi. Defaults to false. Strategy Override. Datatype: Boolean.

- **exit_profit_only**: Exit only when profit is positive. Defaults to false. Strategy Override. Datatype: Boolean.

- **exit_profit_offset**: Minimum profit ratio to exit when exit_profit_only is true. Defaults to 0.0. Strategy Override. Datatype: Float.

- **ignore_roi_if_entry_signal**: Ignore ROI if entry signal is present. Defaults to false. Strategy Override. Datatype: Boolean.

- **ignore_buying_expired_candle_after**: Ignore buying expired candle after X seconds. Datatype: Integer.

- **order_types**: Order types configuration. More information below. Strategy Override. Datatype: Dict.

- **order_time_in_force**: Order time in force configuration. More information below. Strategy Override. Datatype: Dict.

- **position_adjustment_enable**: Enable position adjustment. See strategy callbacks documentation. Strategy Override. Defaults to false. Datatype: Boolean.

- **max_entry_position_adjustment**: Maximum entry position adjustment. Defaults to -1. Datatype: Integer.

- **exchange.password**: Exchange password. Datatype: String.

- **exchange.uid**: Exchange UID. Datatype: String.

- **exchange.pair_whitelist**: Pair whitelist. Defaults to .*/BTC. See plugins documentation. Datatype: List of strings.

- **exchange.pair_blacklist**: Pair blacklist. See plugins documentation. Datatype: List of strings.

- **exchange.ccxt_config**: CCXT config. See CCXT documentation. Datatype: Dict.

- **exchange.ccxt_sync_config**: CCXT sync config. See CCXT documentation. Datatype: Dict.

- **exchange.ccxt_async_config**: CCXT async config. See CCXT documentation. Datatype: Dict.

- **exchange.enable_ws**: Enable websockets. Defaults to true. Datatype: Boolean.

- **exchange.markets_refresh_interval**: Markets refresh interval. Defaults to 60. Datatype: Integer.

- **exchange.skip_open_order_update**: Skip open order update. Defaults to false. Datatype: Boolean.

- **exchange.unknown_fee_rate**: Unknown fee rate. Defaults to None. Datatype: Float.

- **exchange.log_responses**: Log exchange responses. Defaults to false. Datatype: Boolean.

- **exchange.only_from_ccxt**: Only use CCXT. Defaults to false. Datatype: Boolean.

- **experimental.block_bad_exchanges**: Block bad exchanges. Defaults to true. Datatype: Boolean.

- **pairlists**: Pairlists configuration. Defaults to StaticPairList. See plugins documentation. Datatype: List of dicts.

- **telegram.enabled**: Enable telegram. Datatype: Boolean.

- **telegram.token**: Telegram token. Required when telegram.enabled is true. Datatype: String.

- **telegram.chat_id**: Telegram chat ID. Required when telegram.enabled is true. Datatype: String.

- **telegram.balance_dust_level**: Balance dust level for /balance command. Datatype: Float.

- **telegram.reload**: Reload telegram on configuration change. Defaults to true. Datatype: Boolean.

- **telegram.notification_settings.\***: Notification settings. See telegram documentation. Datatype: Dict.

- **telegram.allow_custom_messages**: Allow custom messages. Datatype: Boolean.

- **webhook.enabled**: Enable webhook. Datatype: Boolean.

- **webhook.url**: Webhook URL. Required when webhook.enabled is true. See webhook documentation. Datatype: String.

- **webhook.entry**: Webhook entry configuration. Required when webhook.enabled is true. See webhook documentation. Datatype: Dict.

- **webhook.entry_cancel**: Webhook entry cancel configuration. Required when webhook.enabled is true. See webhook documentation. Datatype: Dict.

- **webhook.entry_fill**: Webhook entry fill configuration. Required when webhook.enabled is true. See webhook documentation. Datatype: Dict.

- **webhook.exit**: Webhook exit configuration. Required when webhook.enabled is true. See webhook documentation. Datatype: Dict.

- **webhook.exit_cancel**: Webhook exit cancel configuration. Required when webhook.enabled is true. See webhook documentation. Datatype: Dict.

- **webhook.exit_fill**: Webhook exit fill configuration. Required when webhook.enabled is true. See webhook documentation. Datatype: Dict.

- **webhook.status**: Webhook status configuration. Required when webhook.enabled is true. See webhook documentation. Datatype: Dict.

- **webhook.allow_custom_messages**: Allow custom messages. Datatype: Boolean.

- **api_server.enabled**: Enable API server. See API Server documentation. Datatype: Boolean.

- **api_server.listen_ip_address**: API server listen IP address. See API Server documentation. Datatype: String.

- **api_server.listen_port**: API server listen port. See API Server documentation. Datatype: Integer.

- **api_server.verbosity**: API server verbosity. Defaults to "info". Datatype: String ("info", "error").

- **api_server.username**: API server username. See API Server documentation. Datatype: String.

- **api_server.password**: API server password. See API Server documentation. Datatype: String.

- **api_server.ws_token**: API server WebSocket token. See API Server documentation. Datatype: String.

- **bot_name**: Bot name. Defaults to "freqtrade". Datatype: String.

- **external_message_consumer**: External message consumer configuration. See Producer/Consumer mode documentation. Datatype: Dict.

- **initial_state**: Initial state. Defaults to "stopped". Datatype: String ("running", "stopped", "paused").

- **force_entry_enable**: Force entry enable. Datatype: Boolean.

- **disable_dataframe_checks**: Disable dataframe checks. Strategy Override. Defaults to False. Datatype: Boolean.

- **internals.process_throttle_secs**: Process throttle seconds. Defaults to 5. Datatype: Integer.

- **internals.heartbeat_interval**: Heartbeat interval. Defaults to 60. Datatype: Integer.

- **internals.sd_notify**: Systemd notify. See advanced setup documentation. Datatype: Boolean.

- **strategy_path**: Strategy path. Defaults to user_data/strategies. Datatype: String.

- **recursive_strategy_search**: Recursive strategy search. Defaults to true. Datatype: Boolean.

- **user_data_dir**: User data directory. Defaults to ./user_data/. Datatype: String.

- **db_url**: Database URL. Defaults to sqlite:///tradesv3.dryrun.sqlite when dry_run is true, and to sqlite:///tradesv3.sqlite when dry_run is false. Datatype: String.

- **logfile**: Logfile path. Datatype: String.

## Configuring amount per trade

### Minimum trade stake

The minimum trade stake is the minimum amount of stake currency that can be used for a trade. This is determined by the exchange and the trading pair.

### Dry-run wallet

The dry-run wallet is the simulated wallet used by the bot running in Dry Run mode. You can set the starting amount using the `dry_run_wallet` parameter.

### Tradable balance

The tradable balance is the amount of stake currency that the bot is allowed to trade. This is determined by the `tradable_balance_ratio` parameter.

### Assign available Capital

You can assign available capital to the bot using the `available_capital` parameter.

### Amend last stake amount

The `amend_last_stake_amount` parameter allows the bot to use a reduced last stake amount if necessary. Defaults to false.

### Static stake amount

You can set a static stake amount using the `stake_amount` parameter.

### Dynamic stake amount

You can set a dynamic stake amount using the `stake_amount` parameter set to "unlimited".

### Dynamic stake amount with position adjustment

You can set a dynamic stake amount with position adjustment using the `position_adjustment_enable` parameter.

## Prices used for orders

### Entry price

The entry price is the price at which the bot will enter a trade.

#### Enter price side

The entry price side can be "ask", "bid", "same", or "other". Defaults to "same".

#### Entry price with Orderbook enabled

When order book is enabled, the bot will use the order book to determine the entry price.

#### Entry price without Orderbook enabled

When order book is disabled, the bot will use the last price to determine the entry price.

#### Check depth of market

The bot can check the depth of market before entering a trade.

### Exit price

The exit price is the price at which the bot will exit a trade.

#### Exit price side

The exit price side can be "ask", "bid", "same", or "other". Defaults to "same".

#### Exit price with Orderbook enabled

When order book is enabled, the bot will use the order book to determine the exit price.

#### Exit price without Orderbook enabled

When order book is disabled, the bot will use the last price to determine the exit price.

### Market order pricing

Market order pricing is used when the bot places market orders.

## Further Configuration details

### Understand minimal_roi

The `minimal_roi` parameter sets the threshold as ratio the bot will use to exit a trade. The bot will exit a trade when the ROI reaches the threshold.

Example:
```json
"minimal_roi": {
    "0": 0.10,
    "240": 0.05,
    "1440": 0.02
}
```

This means:
- Exit with 10% profit after 0 minutes (immediately)
- Exit with 5% profit after 240 minutes (4 hours)
- Exit with 2% profit after 1440 minutes (24 hours)

### Understand force_entry_enable

The `force_entry_enable` parameter allows the bot to force entry even if the entry signal is not present.

### Ignoring expired candles

The `ignore_buying_expired_candle_after` parameter allows the bot to ignore buying expired candles after X seconds.

### Understand order_types

The `order_types` parameter allows you to configure the order types used by the bot.

Example:
```json
"order_types": {
    "entry": "limit",
    "exit": "limit",
    "stoploss": "market",
    "stoploss_on_exchange": false
}
```

### Understand order_time_in_force

The `order_time_in_force` parameter allows you to configure the time in force for orders.

Example:
```json
"order_time_in_force": {
    "entry": "gtc",
    "exit": "gtc"
}
```

#### time_in_force config

The time in force config can be:
- "gtc": Good Till Cancelled
- "ioc": Immediate Or Cancel
- "fok": Fill Or Kill

### Fiat conversion

The `fiat_display_currency` parameter allows you to display profits in a fiat currency.

#### What values can be used for fiat_display_currency?

You can use any fiat currency code supported by the exchange, such as "USD", "EUR", "GBP", etc.

#### Coingecko Rate limit problems

If you encounter rate limit problems with Coingecko, you can use a different fiat display currency or disable fiat conversion.

## Consuming exchange Websockets

The bot can consume exchange websockets to get real-time market data.

## Using Dry-run mode

Dry-run mode allows you to test your strategy without risking real money.

### Considerations for dry-run

- The bot uses simulated data
- No real trades are executed
- The bot uses a simulated wallet

## Switch to production mode

### Setup your exchange account

Before switching to production mode, you need to set up your exchange account and get your API keys.

### To switch your bot in production mode

1. Edit your `config.json` configuration file.
2. Switch `dry-run` to `false` and don't forget to adapt your database URL if set.

To keep your secrets secret, we recommend using a 2nd configuration for your API keys. Simply use the above snippet in a new configuration file (e.g. `config-private.json`) and keep your secrets there.

Then start the bot with both configurations:

```bash
freqtrade trade -c config.json -c config-private.json
```

## Using a proxy with Freqtrade

### Proxy exchange requests

You can use a proxy with Freqtrade by setting the `proxy` parameter in the exchange configuration.

## Next step

[Strategy Quickstart](https://docs.freqtrade.io/en/latest/strategy-101/)
[Strategy Customization](https://docs.freqtrade.io/en/latest/strategy-customization/)
[Strategy Callbacks](https://docs.freqtrade.io/en/latest/strategy-callbacks/)
[Stoploss](https://docs.freqtrade.io/en/latest/stoploss/)
[Plugins](https://docs.freqtrade.io/en/latest/plugins/)
[Start the bot](https://docs.freqtrade.io/en/latest/bot-usage/)
