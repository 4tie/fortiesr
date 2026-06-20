# AGENTS.md — AutoQuant / Strategy Lab

## Mission
Freqtrade-based trading strategy discovery, validation, optimization, and export platform.
**Core rule**: AI suggests → Backend validates → Freqtrade tests → AutoQuant decides.

## Stack
- **Frontend**: React 19 + Vite 8 + Tailwind 4 + daisyUI 5 — **pure JSX, no TypeScript**
- **Backend**: Python 3.11+ FastAPI + uvicorn
- **Settings**: persisted as `user_data/strategy_lab_settings.json` (Pydantic model at `backend/models/contracts.py:SettingsModel`, uses `extra="ignore"` for backward compat)
- **Ollama**: local or cloud AI assistant — provider toggle in Settings (fields: `ollama_provider`, `ollama_api_key`)

## Commands

| Action | Command | Working dir |
|--------|---------|-------------|
| Start backend | `uvicorn server:app --reload --port 8000` | root |
| Start frontend | `npm run dev` | `frontend/` |
| Frontend lint | `npm run lint` | `frontend/` |
| Frontend test | `npm run test` | `frontend/` |
| Backend test (all) | `pytest backend/tests/` | root |
| Backend test (single) | `pytest backend/tests/test_api.py -xvs` | root |

**Order**: backend first, then frontend. Frontend proxies `/api/*` → `localhost:8000` (vite.config.js).

## Architecture

| Path | Role |
|------|------|
| `server.py` | ASGI entrypoint — `uvicorn server:app` |
| `backend/api/app.py` | FastAPI factory — includes all routers, CORS, rate limiter, lifespan |
| `backend/runtime.py` | `create_services()` — wires service graph |
| `backend/app_services.py` | `AppServices` class — wires all stores, runners, registries |
| `backend/settings_store.py` | Load/save settings JSON |
| `backend/models/contracts.py` | All request/response models and `SettingsModel` |
| `backend/api/routers/` | One file per domain (settings, backtest, ai_assistant, auto_quant, etc.) |
| `backend/services/execution/backtest_runner.py` | Synchronous subprocess wrapper for Freqtrade backtests |
| `backend/services/auto_quant/pipeline.py` | Facade over `pipeline_modules/` — all AutoQuant orchestration |
| `backend/services/auto_quant/ollama_service.py` | `OllamaClient` class + `create_ollama_client_from_settings()` |
| `frontend/src/App.jsx` | Tab routing (10 tabs), global layout, health-check polling |
| `frontend/src/components/SettingsTab.jsx` | Settings UI — `GET /api/settings`, `POST /api/settings` |

## Conventions
- Frontend settings state is **local** to `SettingsTab` (`useState`), not in global context
- Theme persisted to `localStorage` key `sl-theme` via `useTheme` hook
- Backend `SettingsModel` uses `extra="ignore"` — adding new fields is backward-compatible
- Ollama API headers: always pass `api_key` kwarg when provider is `ollama_cloud`
- No TypeScript in frontend; all components are `.jsx`
- Metrics source of truth is **backend** — frontend must not recalculate critical trading metrics
- AI client has circuit breaker (5 failures → 5min cooldown) and retry with backoff (4 retries, 10-50s)
- AutoQuant pipeline uses facade pattern — `pipeline.py` delegates to `pipeline_modules/` subpackage

## Constraints
- Do not modify live-trading behavior. Do not enable live trading by default.
- Do not assume a strategy is profitable without validation.
- Do not rewrite architecture unnecessarily — extend existing services.
- Use deterministic backend validation whenever possible. Do not depend on expensive cloud models.
- Self-improvement cycle: saved → tested → scored → compared → rejected or promoted.

## Validation rules
- Scoring, profit factor, drawdown, expectancy, confidence, OOS, WFO changes require: exact formula, unit tests, before/after samples
- No silent threshold changes
- Rate limiter on `POST /api/backtest/run`: 10 req/min per client
