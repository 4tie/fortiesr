# Important — Freqtrade Documentation

This folder contains a complete reference on **freqtrade**: what it is, how it works, and how to use it safely.

## Files in This Folder

| File | What it covers |
|------|----------------|
| `freqtrade-overview.md` | Concept, terminology, architecture, modes, configuration |
| `strategy-development.md` | How to write strategies, callbacks, pandas rules, hyperopt parameters |
| `backtesting-hyperopt.md` | Running backtests, hyperopt, loss functions, assumptions |
| `plugins-and-protections.md` | Pairlists, filters, protection rules |
| `api-integration.md` | REST API, WebSocket, Telegram, webhooks, custom frontend |
| `strategy-ai-example.md` | Deep analysis of the current `AIStrategy.py` — problems and fixes |
| `risk-and-common-mistakes.md` | Risk guardrails, red flags, checklist before live trading |

## How to Use These Docs

- Start with `freqtrade-overview.md` for the big picture
- Read `strategy-development.md` before writing or modifying strategies
- Use `backtesting-hyperopt.md` when running tests or optimizations
- Read `strategy-ai-example.md` for the current state of `AIStrategy.py`
- Use `risk-and-common-mistakes.md` as a safety checklist before any live decisions
- Use `plugins-and-protections.md` and `api-integration.md` when building integrations

## Quick Rule

No real money. No live mode. Until:
- Strategy is understood end-to-end
- Backtest looks reasonable
- Dry-run matches backtest
- Stoploss is reasonable
- Protections are enabled
- At least a few days of clean dry-run data exist

## Current Project Strategy

- Strategy: `user_data/strategies/AIStrategy.py`
- Params: `user_data/strategies/AIStrategy.json`
- **Status: NOT SAFE FOR LIVE. Wide stoploss (-33.6%), suspicious ROI table. Needs fixes before use.**

See `strategy-ai-example.md` for full analysis.
