"""Router: /api/ai

Local-LLM powered assistant using Ollama.

GET  /api/ai/models            — fetches available models from the configured
                                  Ollama instance ({ollama_api_url}/api/tags).
POST /api/ai/explain-strategy  — reads a strategy .py file and returns a
                                  plain-language explanation via the configured
                                  Ollama model.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])

TIMEOUT_GENERATE = 120.0
TIMEOUT_TAGS     = 30.0


def _build_headers(base_url: str, *, include_content_type: bool = False) -> dict[str, str]:
    """Return the standard HTTP headers for Ollama requests.

    * ``Host``         — derived from the configured URL so reverse-proxies and
                         Cloudflare / Tailscale tunnels receive the correct header.
    * ``Accept``       — always ``application/json``.
    * ``Content-Type`` — ``application/json`` for POST bodies (optional for GETs).
    """
    parsed = urlparse(base_url)
    host = parsed.netloc or parsed.path  # handles bare "hostname:port" strings too
    headers: dict[str, str] = {
        "Host":   host,
        "Accept": "application/json",
    }
    if include_content_type:
        headers["Content-Type"] = "application/json"
    return headers

SYSTEM_PROMPT = (
    "You are a friendly trading mentor. "
    "Read the following Freqtrade Python strategy code. "
    "Explain its core logic — buy conditions, sell conditions, and indicators used — "
    "in simple, non-technical language. "
    "Use real-world analogies like buying/selling a car or real estate to explain "
    "the concepts where helpful. "
    "Structure your answer with clear sections: Indicators Used, Buy Logic, Sell Logic, "
    "and a short Overall Summary. "
    "Keep it concise and friendly."
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _read_strategy_source(strategies_dir: str, strategy_name: str) -> str:
    path = Path(strategies_dir) / f"{strategy_name}.py"
    if not path.exists():
        raise FileNotFoundError(
            f"Strategy file '{strategy_name}.py' not found in {strategies_dir}"
        )
    return path.read_text(encoding="utf-8", errors="replace")


def _ollama_error(exc: Exception) -> HTTPException:
    """Convert common httpx errors into friendly 503/502/500 responses."""
    if isinstance(exc, httpx.ConnectError):
        return HTTPException(
            status_code=503,
            detail=(
                "Could not connect to Ollama. "
                "Check the Ollama API URL in Settings and ensure Ollama is running."
            ),
        )
    if isinstance(exc, httpx.TimeoutException):
        return HTTPException(
            status_code=503,
            detail=(
                "Ollama took too long to respond. "
                "Try a smaller/faster model or check that Ollama is not overloaded."
            ),
        )
    if isinstance(exc, httpx.HTTPStatusError):
        detail = f"Ollama returned HTTP {exc.response.status_code}."
        try:
            detail = exc.response.json().get("error", detail)
        except Exception:
            pass
        return HTTPException(status_code=502, detail=detail)
    return HTTPException(status_code=500, detail=f"Unexpected Ollama error: {exc}")


# ── models endpoint ───────────────────────────────────────────────────────────

@router.get(
    "/models",
    summary="List available Ollama models",
    description=(
        "Calls {ollama_api_url}/api/tags on the configured Ollama instance and "
        "returns a sorted list of model names. Returns 503 if unreachable."
    ),
)
async def list_models(request: Request) -> dict:
    services = request.app.state.services
    cfg = services.settings_store.load()
    base_url = cfg.ollama_api_url.rstrip("/")
    tags_url = f"{base_url}/api/tags"

    headers = _build_headers(base_url)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_TAGS) as client:
            resp = await client.get(tags_url, headers=headers)
            resp.raise_for_status()
            try:
                data = resp.json()
            except json.JSONDecodeError:
                return {
                    "models": [],
                    "reachable": False,
                    "ollama_api_url": base_url,
                    "error": f"Ollama returned non-JSON — check the URL is correct.",
                }
    except httpx.ConnectError:
        return {
            "models": [],
            "reachable": False,
            "ollama_api_url": base_url,
            "error": "Could not connect to Ollama. Make sure it is running and the URL is correct.",
        }
    except httpx.TimeoutException:
        return {
            "models": [],
            "reachable": False,
            "ollama_api_url": base_url,
            "error": "Ollama did not respond in time. It may be busy or unreachable.",
        }
    except Exception as exc:
        return {
            "models": [],
            "reachable": False,
            "ollama_api_url": base_url,
            "error": str(exc),
        }

    raw_models = data.get("models", [])
    names = sorted(
        m.get("name", "") for m in raw_models if isinstance(m, dict) and m.get("name")
    )
    return {"models": names, "reachable": True, "ollama_api_url": base_url}


# ── explain endpoint ──────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    strategy_name: str = Field(..., description="Strategy filename without .py")
    model: str | None = Field(
        default=None,
        description="Ollama model to use; falls back to ollama_model from settings.",
    )


@router.post(
    "/explain-strategy",
    summary="Explain a strategy's logic using the configured local Ollama LLM",
    description=(
        "Reads the strategy .py file, sends it to the Ollama instance at the "
        "configured ollama_api_url, and returns a plain-language explanation. "
        "The model is taken from settings unless overridden in the request body."
    ),
)
async def explain_strategy(body: ExplainRequest, request: Request) -> dict:
    services = request.app.state.services

    try:
        cfg = services.settings_store.load()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read settings: {exc}")

    model = body.model or cfg.ollama_model
    if not model:
        raise HTTPException(
            status_code=422,
            detail=(
                "No AI model configured. "
                "Go to Settings → AI Assistant and select a model first."
            ),
        )

    try:
        source = await asyncio.to_thread(
            _read_strategy_source, cfg.strategies_directory_path, body.strategy_name
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not read strategy file: {exc}")

    base_url = cfg.ollama_api_url.rstrip("/")
    generate_url = f"{base_url}/api/generate"

    user_message = (
        f"Here is the Freqtrade strategy code for '{body.strategy_name}':\n\n"
        f"```python\n{source}\n```\n\n"
        "Please explain this strategy's logic as described."
    )

    payload = {
        "model":  model,
        "prompt": user_message,
        "system": SYSTEM_PROMPT,
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 1024},
    }

    headers = _build_headers(base_url, include_content_type=True)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_GENERATE) as client:
            resp = await client.post(generate_url, content=json.dumps(payload).encode(), headers=headers)
            resp.raise_for_status()
            try:
                explanation = resp.json().get("response", "").strip()
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Ollama returned non-JSON for /api/generate: {resp.text[:200]}",
                ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise _ollama_error(exc)

    return {
        "strategy_name": body.strategy_name,
        "model":         model,
        "ollama_api_url": base_url,
        "explanation":   explanation,
    }
