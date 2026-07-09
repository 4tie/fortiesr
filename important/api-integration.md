# API and Integration — Connecting to Freqtrade

Freqtrade exposes its data and controls via Web UI, REST API, Telegram, and Webhooks.

When building your own tools, the **REST API** is the most useful integration point.

---

## Enabling the REST API

Add to your config:

```json
{
    "api_server": {
        "enabled": true,
        "listen_ip_address": "127.0.0.1",
        "listen_port": 8080,
        "username": "Freqtrader",
        "password": "SuperSecret1!",
        "jwt_secret_key": "somethingRandomAndLong123",
        "CORS_origins": ["http://localhost:5177"],
        "ws_token": "your_websocket_token"
    }
}
```

- `CORS_origins` must match the **exact origin** of your frontend, including the port.
- Trailing slash in CORS origin is **not allowed**. `http://localhost:8080/` will fail.
- Use `jwt_secret_key` that is at least 32 characters. Change the default password.

Security:
- Default listens on `127.0.0.1`, so it is only accessible from your machine.
- If you expose to the internet, expect it to be attacked. Use SSH tunnel or VPN instead.
- FreqUI does **not** support HTTPS. Do not expose it directly.

---

## Authentication

1. Login to get access token:

```bash
curl -X POST --user Freqtrader http://127.0.0.1:8080/api/v1/token/login
```

Returns:
```json
{"access_token":"eyJ0...","refresh_token":"eyJ0..."}
```

2. Use access token in requests:

```bash
curl -X GET \
  -H "Authorization: Bearer eyJ0..." \
  http://127.0.0.1:8080/api/v1/count
```

3. Refresh when expired (access tokens expire in 15 minutes):

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ0..." \
  http://127.0.0.1:8080/api/v1/token/refresh
```

---

## Most Useful Endpoints

### Status and Health

| Endpoint | Method | Use |
|----------|--------|-----|
| `/api/v1/ping` | GET | Health check |
| `/api/v1/status` | GET | Open trades |
| `/api/v1/count` | GET | Number of open trades |
| `/api/v1/profit` | GET | Profit summary |
| `/api/v1/stats` | GET | Duration + sell-reason stats |
| `/api/v1/performance` | GET | Per-pair performance |
| `/api/v1/daily` | GET | Daily profits |
| `/api/v1/weekly` | GET | Weekly profits |
| `/api/v1/monthly` | GET | Monthly profits |
| `/api/v1/balance` | GET | Account balance |
| `/api/v1/history` | GET | Trade history |
| `/api/v1/trade/<id>` | GET | Specific trade |

### Control

| Endpoint | Method | Use |
|----------|--------|-----|
| `/api/v1/start` | POST | Start the bot |
| `/api/v1/stop` | POST | Stop the bot |
| `/api/v1/reload_config` | POST | Reload config from disk |
| `/api/v1/forceenter` | POST | Force entry on a pair |
| `/api/v1/forceexit` | POST | Force exit a trade |
| `/api/v1/blacklist` | POST | Add pairs to blacklist |
| `/api/v1/locks` | GET | Current pair locks |

### Strategies and Config

| Endpoint | Method | Use |
|----------|--------|-----|
| `/api/v1/strategies` | GET | List strategies |
| `/api/v1/strategy/<name>` | GET | Strategy details |
| `/api/v1/show_config` | GET | Effective config |

### Data

| Endpoint | Method | Use |
|----------|--------|-----|
| `/api/v1/available_pairs` | GET | Available backtest pairs |
| `/api/v1/pair_candles` | GET | Live dataframe for a pair |
| `/api/v1/pair_history` | GET | Historic analyzed dataframe |
| `/api/v1/plot_config` | GET | Strategy plot config |

---

## Programmatic Client

Install lightweight client separately:

```bash
pip install freqtrade-client
```

Python usage:

```python
from freqtrade_client import FtRestClient

client = FtRestClient("http://127.0.0.1:8080", "Freqtrader", "SuperSecret1!")
client.login()

print(client.ping())
print(client.status())
print(client.profit())
```

CLI usage:

```bash
freqtrade-client --config rest_config.json status
freqtrade-client --config rest_config.json profit
freqtrade-client --config rest_config.json forceenter BTC/USDT long
```

---

## WebSocket

Freqtrade backend exposes a WebSocket at `/api/v1/ws/<ws_token>`.

It streams live updates:
- Trade status changes
- Bot status changes
- New candle events

Useful for real-time dashboard updates.

WebSocket is also what FreqUI uses to stay in sync without polling.

---

## Telegram

You can control and monitor the bot via Telegram bot.

Configure in your config:

```json
{
    "telegram": {
        "enabled": true,
        "token": "TELEGRAM_BOT_TOKEN",
        "chat_id": "YOUR_CHAT_ID"
    }
}
```

Key Telegram commands:
- `/start`, `/stop` — start/stop bot
- `/status` — open trades
- `/profit` — profit summary
- `/forceexit` — force exit trades
- `/reload_config` — reload config
- `/performance` — per-pair performance

Telegram is useful for monitoring on mobile. It is not meant for custom integrations.

---

## Webhooks

Freqtrade can send events to external services (Discord, Slack, custom webhook).

Configure:

```json
{
    "webhook": {
        "enabled": true,
        "url": "https://your-service.com/webhook",
        "webhookFormat": "json",
        "stake_currency": "USDT",
        "timeframe": "5m"
    }
}
```

Events sent:
- Bot start/stop
- Buy/sell filled
- Stoploss triggered
- Daily/weekly profit summaries

---

## Building a Custom Frontend

When building your own app (like AeRo or another dashboard):

1. Enable API server.
2. Add your frontend origin to `CORS_origins`.
3. Login via `/api/v1/token/login`.
4. Store and refresh the access token.
5. Poll `/api/v1/status` and `/api/v1/profit` for dashboard.
6. Use `/api/v1/trade/<id>` for trade details.
7. Use WebSocket for real-time updates.

For backtest results, use `/api/v1/backtest` in webserver mode, or read the JSON files from `user_data/backtest_results/` directly.

---

## Webserver Mode

```bash
freqtrade webserver
```

Special mode that enables extra features in the API:
- Download data via `/api/v1/download_data`
- Test pairlists via `/api/v1/test_pairlist`
- Run backtests via `/api/v1/backtest`
- Generate plots

This is what FreqUI uses behind the scenes. If your app needs to trigger backtests, webserver mode is required.

---

## Common Integration Issues

- **CORS error in browser**: `CORS_origins` missing your origin, or extra trailing slash in origin URL.
- **401 Unauthorized**: wrong username/password, or expired access token.
- **403 on backtest endpoints**: bot must be running in `webserver` mode, not just `trade`.
- **Empty backtest results**: data not downloaded for the pair/timeframe/timerange.
- **401 on WebSocket**: wrong or missing `ws_token`.

Sources:
- https://www.freqtrade.io/en/stable/rest-api/
- https://www.freqtrade.io/en/stable/freq-ui/
- https://www.freqtrade.io/en/stable/telegram-usage/
- https://www.freqtrade.io/en/stable/webhook-config/
