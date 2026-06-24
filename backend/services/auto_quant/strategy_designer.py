"""Strategy Designer helper for AI-assisted, template-safe StrategySpec creation.

Hermes/small local models should not emit a full StrategySpec. They only choose a
small StrategyIntent, then this module deterministically expands it into a full
StrategySpec that existing validation and candidate workflows can consume.
"""

from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from ...models.strategy_spec import StrategySpec, validate_spec
from .ollama_service import clean_json_response


_PROMPT_PATH = Path(__file__).parent / "prompts" / "strategy_designer.md"
_SIMPLE_PROMPT_PATH = Path(__file__).parent / "prompts" / "strategy_designer_simple.md"

VALID_FAMILIES = {
    "momentum",
    "trend_following",
    "mean_reversion",
    "breakout",
    "adaptive",
    "ensemble",
}
VALID_TIMEFRAMES = {"1m", "5m", "15m", "30m", "1h", "4h", "1d"}
VALID_INDICATOR_SETS = {
    "rsi_only",
    "rsi_ema",
    "rsi_ema_atr",
    "macd_bb",
    "multi_indicator",
}
VALID_RISK_PROFILES = {"conservative", "balanced", "aggressive"}

# MVP: generated templates are long-only. Short/both need a separate template task.
SUPPORTED_DIRECTIONS = {"long"}

TRADING_STYLE_TO_FAMILY = {
    "scalping": "momentum",
    "intraday": "momentum",
    "swing": "mean_reversion",
    "position": "trend_following",
    "trend_following": "trend_following",
    "mean_reversion": "mean_reversion",
    "momentum": "momentum",
    "breakout": "breakout",
    "adaptive": "adaptive",
    "ensemble": "ensemble",
}

RISK_PROFILE_ALIASES = {
    "low": "conservative",
    "lower": "conservative",
    "conservative": "conservative",
    "balanced": "balanced",
    "standard": "balanced",
    "aggressive": "aggressive",
    "high": "aggressive",
}

_INDICATOR_SET_TEMPLATES: dict[str, list[dict[str, Any]]] = {
    "rsi_only": [
        {"name": "rsi", "params": {"period": 14}},
    ],
    "rsi_ema": [
        {"name": "rsi", "params": {"period": 14}},
        {"name": "ema_cross", "params": {"fast_period": 12, "slow_period": 26}},
    ],
    "rsi_ema_atr": [
        {"name": "rsi", "params": {"period": 14}},
        {"name": "ema_cross", "params": {"fast_period": 12, "slow_period": 26}},
        {"name": "atr", "params": {"period": 14}},
    ],
    "macd_bb": [
        {"name": "macd", "params": {"fast": 12, "slow": 26, "signal": 9}},
        {"name": "bbands", "params": {"period": 20, "std_dev": 2}},
    ],
    "multi_indicator": [
        {"name": "rsi", "params": {"period": 14}},
        {"name": "macd", "params": {"fast": 12, "slow": 26, "signal": 9}},
        {"name": "bbands", "params": {"period": 20, "std_dev": 2}},
        {"name": "atr", "params": {"period": 14}},
    ],
}

_FAMILY_CONDITION_TEMPLATES: dict[str, dict[str, list[dict[str, Any]]]] = {
    "momentum": {
        "entry": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": ">",
                "value_or_indicator_b": 50,
            }
        ],
        "exit": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": "<",
                "value_or_indicator_b": 45,
            }
        ],
    },
    "trend_following": {
        "entry": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": ">",
                "value_or_indicator_b": 55,
            }
        ],
        "exit": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": "<",
                "value_or_indicator_b": 48,
            }
        ],
    },
    "mean_reversion": {
        "entry": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": "<",
                "value_or_indicator_b": 30,
            }
        ],
        "exit": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": ">",
                "value_or_indicator_b": 70,
            }
        ],
    },
    "breakout": {
        "entry": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": ">",
                "value_or_indicator_b": 60,
            }
        ],
        "exit": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": "<",
                "value_or_indicator_b": 50,
            }
        ],
    },
    "adaptive": {
        "entry": [
            {
                "type": "indicator_threshold",
                "indicator_a": "atr",
                "operator": ">",
                "value_or_indicator_b": 0.02,
            }
        ],
        "exit": [
            {
                "type": "indicator_threshold",
                "indicator_a": "atr",
                "operator": "<",
                "value_or_indicator_b": 0.01,
            }
        ],
    },
    "ensemble": {
        "entry": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": ">",
                "value_or_indicator_b": 50,
            }
        ],
        "exit": [
            {
                "type": "indicator_threshold",
                "indicator_a": "rsi",
                "operator": "<",
                "value_or_indicator_b": 45,
            }
        ],
    },
}

_RISK_PROFILE_SETTINGS: dict[str, dict[str, Any]] = {
    "conservative": {
        "stoploss": -0.05,
        "roi": [[0, 0.05], [30, 0.03], [60, 0.01]],
        "max_open_trades": 2,
    },
    "balanced": {
        "stoploss": -0.08,
        "roi": [[0, 0.08], [30, 0.04], [60, 0.02]],
        "max_open_trades": 3,
    },
    "aggressive": {
        "stoploss": -0.12,
        "roi": [[0, 0.12], [30, 0.07], [60, 0.03]],
        "max_open_trades": 4,
    },
}


def _normalize_text(value: Any, fallback: str) -> str:
    text = str(value or "").strip().lower()
    return text or fallback


def _normalize_risk_profile(value: Any) -> str:
    return RISK_PROFILE_ALIASES.get(_normalize_text(value, "balanced"), "balanced")


def _safe_strategy_name(value: str | None, *, family: str, timeframe: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        raw = f"Hermes_{family}_{timeframe}"
    raw = re.sub(r"[^A-Za-z0-9_]", "_", raw)
    if not raw or not raw[0].isalpha():
        raw = f"Hermes_{raw}"
    return raw[:64]


def _fallback_intent(
    *,
    trading_style: str,
    timeframe: str,
    direction: str | None,
    risk_profile: str | None,
) -> dict[str, str]:
    family = TRADING_STYLE_TO_FAMILY.get(_normalize_text(trading_style, "momentum"), "momentum")
    clean_timeframe = timeframe if timeframe in VALID_TIMEFRAMES else "5m"
    clean_risk = _normalize_risk_profile(risk_profile)
    clean_direction = direction if direction in SUPPORTED_DIRECTIONS else "long"

    if family == "mean_reversion":
        indicator_set = "rsi_only"
    elif family in {"momentum", "trend_following"}:
        indicator_set = "rsi_ema_atr"
    elif family == "breakout":
        indicator_set = "multi_indicator"
    else:
        indicator_set = "rsi_ema_atr"

    return {
        "family": family,
        "timeframe": clean_timeframe,
        "indicator_set": indicator_set,
        "risk_profile": clean_risk,
        "direction": clean_direction,
    }


def _sanitize_intent(decision: dict[str, Any], fallback: dict[str, str]) -> dict[str, str]:
    family = _normalize_text(decision.get("family"), fallback["family"])
    timeframe = str(decision.get("timeframe") or fallback["timeframe"]).strip()
    indicator_set = _normalize_text(decision.get("indicator_set"), fallback["indicator_set"])
    risk_profile = _normalize_risk_profile(decision.get("risk_profile") or fallback["risk_profile"])
    direction = _normalize_text(decision.get("direction"), fallback["direction"])

    return {
        "family": family if family in VALID_FAMILIES else fallback["family"],
        "timeframe": timeframe if timeframe in VALID_TIMEFRAMES else fallback["timeframe"],
        "indicator_set": indicator_set if indicator_set in VALID_INDICATOR_SETS else fallback["indicator_set"],
        "risk_profile": risk_profile if risk_profile in VALID_RISK_PROFILES else fallback["risk_profile"],
        "direction": direction if direction in SUPPORTED_DIRECTIONS else fallback["direction"],
    }


def build_spec_from_decision(decision: dict[str, Any], user_inputs: dict[str, Any]) -> StrategySpec:
    """Build a complete StrategySpec from a compact StrategyIntent."""
    fallback = _fallback_intent(
        trading_style=str(user_inputs.get("trading_style") or "momentum"),
        timeframe=str(user_inputs.get("timeframe") or "5m"),
        direction=str(user_inputs.get("direction") or "long"),
        risk_profile=str(user_inputs.get("risk_profile") or "balanced"),
    )
    intent = _sanitize_intent(decision, fallback)

    indicators = deepcopy(_INDICATOR_SET_TEMPLATES[intent["indicator_set"]])
    indicator_names = {item["name"] for item in indicators}

    family = intent["family"]
    if family == "adaptive" and "atr" not in indicator_names:
        family = "momentum"
    conditions = deepcopy(_FAMILY_CONDITION_TEMPLATES.get(family, _FAMILY_CONDITION_TEMPLATES["momentum"]))

    # If selected conditions reference indicators that are not in the set, fall back to RSI.
    for side in ("entry", "exit"):
        for condition in conditions[side]:
            if condition["indicator_a"] not in indicator_names:
                condition["indicator_a"] = "rsi"

    risk_settings = _RISK_PROFILE_SETTINGS[intent["risk_profile"]]
    name = _safe_strategy_name(user_inputs.get("name"), family=family, timeframe=intent["timeframe"])
    description = str(user_inputs.get("description") or "").strip()
    if not description:
        description = (
            f"AI-selected {family} intent using {intent['indicator_set']} on "
            f"{intent['timeframe']} with {intent['risk_profile']} risk."
        )

    return StrategySpec(
        name=name,
        description=description[:500],
        timeframe=intent["timeframe"],
        trading_style=family,
        direction="long",
        indicators=indicators,
        entry_conditions=conditions["entry"],
        exit_conditions=conditions["exit"],
        stoploss=risk_settings["stoploss"],
        trailing={"trailing_stop": False},
        position_sizing={"method": "fixed"},
        max_open_trades=risk_settings["max_open_trades"],
        roi=risk_settings["roi"],
        max_iterations=3,
        iteration_count=0,
        parent_spec_hash="",
    )


def _parse_intent_json(raw_response: str, fallback: dict[str, str]) -> dict[str, str]:
    cleaned = clean_json_response(raw_response)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        # Tiny fallback: avoid failing the workflow just because a small model wrapped or clipped intent.
        return fallback
    if not isinstance(payload, dict):
        return fallback
    return _sanitize_intent(payload, fallback)


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
    """Generate StrategySpec using compact StrategyIntent + deterministic expansion."""
    requested_direction = _normalize_text(direction, "long")
    if requested_direction not in SUPPORTED_DIRECTIONS:
        return {
            "spec": None,
            "errors": ["UNSUPPORTED_DIRECTION_MVP_LONG_ONLY"],
            "raw_response": "",
        }

    fallback = _fallback_intent(
        trading_style=trading_style,
        timeframe=timeframe,
        direction=requested_direction,
        risk_profile=risk_profile,
    )

    try:
        system_prompt = _SIMPLE_PROMPT_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")

    user_prompt = "\n".join(
        [
            "Choose one compact StrategyIntent from these user preferences.",
            f"trading_style: {trading_style}",
            f"timeframe: {timeframe}",
            f"direction: {requested_direction}",
            f"risk_profile: {_normalize_risk_profile(risk_profile)}",
            f"notes: {description or ''}",
            "Return JSON only with keys: family, timeframe, indicator_set, risk_profile, direction.",
        ]
    )

    raw_response = await client.generate(
        user_prompt,
        system_prompt=system_prompt,
        feature="strategy_designer_intent",
        options={
            "num_predict": 220,
            "temperature": 0,
        },
    )
    if not raw_response:
        decision = fallback
        raw_response = json.dumps(fallback)
    else:
        decision = _parse_intent_json(raw_response, fallback)

    try:
        spec = build_spec_from_decision(
            decision,
            {
                "trading_style": trading_style,
                "timeframe": timeframe,
                "direction": requested_direction,
                "risk_profile": risk_profile,
                "name": name,
                "description": description,
            },
        )
    except (ValidationError, TypeError, ValueError) as exc:
        return {"spec": None, "errors": [f"SPEC_BUILD_ERROR: {exc}"], "raw_response": raw_response}

    errors = validate_spec(spec, strict_validation=True)
    if errors:
        return {"spec": None, "errors": errors, "raw_response": raw_response}

    return {"spec": spec, "errors": [], "raw_response": raw_response}


async def generate_strategy_spec_simple(*args: Any, **kwargs: Any) -> dict[str, Any]:
    """Backward-compatible alias for the compact-intent generator."""
    return await generate_strategy_spec(*args, **kwargs)
