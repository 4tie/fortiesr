"""Strategy Designer helper for AI-proposed StrategySpec JSON."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from ...models.strategy_spec import StrategySpec, validate_spec
from .ollama_service import clean_json_response


_PROMPT_PATH = Path(__file__).parent / "prompts" / "strategy_designer.md"


async def generate_strategy_spec(
    client: Any,
    *,
    trading_style: str,
    timeframe: str,
    direction: str | None = None,
    risk_profile: str | None = None,
    name: str | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    """Generate and validate a StrategySpec using an existing Ollama client."""
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    user_prompt = _build_user_prompt(
        trading_style=trading_style,
        timeframe=timeframe,
        direction=direction,
        risk_profile=risk_profile,
        name=name,
        description=description,
    )

    raw_response = await client.generate(
        user_prompt,
        system_prompt=system_prompt,
        feature="strategy_designer",
    )
    if not raw_response:
        return {"spec": None, "errors": ["EMPTY_OLLAMA_RESPONSE"], "raw_response": raw_response}

    cleaned = clean_json_response(raw_response)
    
    # Try to fix incomplete JSON by finding the last complete object
    if not cleaned.strip().endswith('}'):
        # Try to find the last complete JSON object by counting braces
        brace_count = 0
        last_complete_pos = -1
        for i, char in enumerate(cleaned):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    last_complete_pos = i
        
        if last_complete_pos > 0:
            cleaned = cleaned[:last_complete_pos + 1]
    
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return {"spec": None, "errors": [f"INVALID_JSON: {e}"], "raw_response": raw_response}

    if not isinstance(payload, dict):
        return {"spec": None, "errors": ["INVALID_STRATEGY_SPEC_SCHEMA"], "raw_response": raw_response}

    # Post-process to fix common AI model errors
    payload = _fix_common_spec_errors(payload)

    try:
        spec = StrategySpec(**payload)
    except (ValidationError, TypeError, ValueError) as e:
        # Return detailed error for debugging
        error_msg = f"INVALID_STRATEGY_SPEC_SCHEMA: {str(e)}"
        if isinstance(e, ValidationError):
            error_msg = f"INVALID_STRATEGY_SPEC_SCHEMA: {e.errors()}"
        return {"spec": None, "errors": [error_msg], "raw_response": raw_response}

    errors = validate_spec(spec, strict_validation=True)
    if errors:
        return {"spec": None, "errors": errors, "raw_response": raw_response}

    return {"spec": spec, "errors": [], "raw_response": raw_response}


def _build_user_prompt(
    *,
    trading_style: str,
    timeframe: str,
    direction: str | None,
    risk_profile: str | None,
    name: str | None,
    description: str | None,
) -> str:
    lines = [
        "Create one StrategySpec JSON object from these user inputs:",
        f"- trading_style: {trading_style}",
        f"- timeframe: {timeframe}",
    ]
    if direction:
        lines.append(f"- direction: {direction}")
    if risk_profile:
        lines.append(f"- risk_profile: {risk_profile}")
    if name:
        lines.append(f"- requested_name: {name}")
    if description:
        lines.append(f"- requested_description: {description}")
    lines.append("Return JSON only.")
    return "\n".join(lines)


def _fix_common_spec_errors(payload: dict) -> dict:
    """Fix common errors made by AI models in StrategySpec generation.

    This post-processing step corrects:
    - Empty indicators array (adds default RSI indicator)
    - Empty entry_conditions array (adds default RSI threshold condition)
    - Empty exit_conditions array (adds default RSI threshold condition)
    - Invalid position_sizing.method (changes "balanced" to "fixed")
    - Missing required fields (adds sensible defaults)
    """
    # Fix empty indicators
    if not payload.get("indicators") or len(payload.get("indicators", [])) == 0:
        payload["indicators"] = [{"name": "rsi", "params": {"period": 14}}]

    # Fix empty entry_conditions
    if not payload.get("entry_conditions") or len(payload.get("entry_conditions", [])) == 0:
        payload["entry_conditions"] = [
            {"type": "indicator_threshold", "indicator_a": "rsi", "operator": "<", "value_or_indicator_b": 30.0}
        ]

    # Fix empty exit_conditions
    if not payload.get("exit_conditions") or len(payload.get("exit_conditions", [])) == 0:
        trailing = payload.get("trailing", {})
        if not trailing.get("trailing_stop", False):
            payload["exit_conditions"] = [
                {"type": "indicator_threshold", "indicator_a": "rsi", "operator": ">", "value_or_indicator_b": 70.0}
            ]

    # Fix invalid position_sizing.method
    if "position_sizing" in payload:
        if isinstance(payload["position_sizing"], dict):
            method = payload["position_sizing"].get("method", "fixed")
            if method not in ["fixed", "atr_percent", "risk_per_trade"]:
                payload["position_sizing"]["method"] = "fixed"
    else:
        payload["position_sizing"] = {"method": "fixed"}

    # Fix invalid stoploss (must be negative)
    if "stoploss" in payload:
        if payload["stoploss"] >= 0:
            payload["stoploss"] = -0.10

    # Fix empty ROI
    if not payload.get("roi") or len(payload.get("roi", [])) == 0:
        payload["roi"] = [[0, 0.12]]

    # Fix missing trailing object
    if "trailing" not in payload:
        payload["trailing"] = {"trailing_stop": False}

    # Fix missing max_open_trades
    if "max_open_trades" not in payload:
        payload["max_open_trades"] = 3

    # Fix missing max_iterations
    if "max_iterations" not in payload:
        payload["max_iterations"] = 3

    # Fix missing iteration_count
    if "iteration_count" not in payload:
        payload["iteration_count"] = 0

    # Fix missing parent_spec_hash
    if "parent_spec_hash" not in payload:
        payload["parent_spec_hash"] = ""

    return payload
