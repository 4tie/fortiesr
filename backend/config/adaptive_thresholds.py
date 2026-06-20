"""
Adaptive Threshold Configuration - Strategy and timeframe specific
Thresholds adapt based on trading style, timeframe, and market conditions
"""

from dataclasses import dataclass
from typing import Dict, Literal
import json
from pathlib import Path


@dataclass
class ValidationThresholds:
    """Thresholds for a validation tier"""
    min_profit_factor: float
    max_drawdown: float
    min_expectancy: float
    min_trades: int
    min_win_rate: float = 0.0
    min_oos_profit: float = 0.0
    min_robustness_score: float = 0.0
    min_walk_forward_score: float = 0.0


class AdaptiveThresholdConfig:
    """
    Generates validation thresholds adaptive to:
    - Trading style (scalping, intraday, swing, position)
    - Timeframe (1m, 5m, 15m, 1h, 4h, 1d, etc.)
    - Validation tier (discovery, validation, elite)
    """

    # Base thresholds by trading style
    STYLE_BASES = {
        "scalping": {
            "discovery": {
                "min_profit_factor": 1.05,
                "max_drawdown": 0.50,
                "min_trades": 500,
                "min_expectancy": 0.0001,
            },
            "validation": {
                "min_profit_factor": 1.20,
                "max_drawdown": 0.35,
                "min_trades": 600,
                "min_expectancy": 0.0002,
            },
            "elite": {
                "min_profit_factor": 1.40,
                "max_drawdown": 0.20,
                "min_trades": 700,
                "min_expectancy": 0.0003,
                "min_robustness_score": 0.70,
                "min_walk_forward_score": 0.70,
            },
        },
        "intraday": {
            "discovery": {
                "min_profit_factor": 1.10,
                "max_drawdown": 0.40,
                "min_trades": 300,
                "min_expectancy": 0.001,
            },
            "validation": {
                "min_profit_factor": 1.30,
                "max_drawdown": 0.25,
                "min_trades": 400,
                "min_expectancy": 0.002,
            },
            "elite": {
                "min_profit_factor": 1.50,
                "max_drawdown": 0.15,
                "min_trades": 500,
                "min_expectancy": 0.003,
                "min_robustness_score": 0.75,
                "min_walk_forward_score": 0.75,
            },
        },
        "swing": {
            "discovery": {
                "min_profit_factor": 1.15,
                "max_drawdown": 0.40,
                "min_trades": 80,
                "min_expectancy": 0.005,
            },
            "validation": {
                "min_profit_factor": 1.35,
                "max_drawdown": 0.30,
                "min_trades": 120,
                "min_expectancy": 0.010,
                "min_win_rate": 0.40,
            },
            "elite": {
                "min_profit_factor": 1.55,
                "max_drawdown": 0.20,
                "min_trades": 150,
                "min_expectancy": 0.015,
                "min_robustness_score": 0.70,
                "min_walk_forward_score": 0.70,
                "min_win_rate": 0.45,
            },
        },
        "position": {
            "discovery": {
                "min_profit_factor": 1.20,
                "max_drawdown": 0.40,
                "min_trades": 40,
                "min_expectancy": 0.010,
            },
            "validation": {
                "min_profit_factor": 1.40,
                "max_drawdown": 0.30,
                "min_trades": 60,
                "min_expectancy": 0.020,
                "min_win_rate": 0.45,
            },
            "elite": {
                "min_profit_factor": 1.60,
                "max_drawdown": 0.20,
                "min_trades": 80,
                "min_expectancy": 0.030,
                "min_robustness_score": 0.75,
                "min_walk_forward_score": 0.75,
                "min_win_rate": 0.50,
            },
        },
    }

    # Timeframe multipliers (adjust based on candle frequency)
    TIMEFRAME_MULTIPLIERS = {
        "1m": {"trade_count": 1.5, "expectancy": 0.5, "pf": 1.05},
        "3m": {"trade_count": 1.4, "expectancy": 0.6, "pf": 1.04},
        "5m": {"trade_count": 1.3, "expectancy": 0.7, "pf": 1.03},
        "15m": {"trade_count": 1.2, "expectancy": 0.8, "pf": 1.02},
        "30m": {"trade_count": 1.1, "expectancy": 0.9, "pf": 1.01},
        "1h": {"trade_count": 1.0, "expectancy": 1.0, "pf": 1.0},
        "4h": {"trade_count": 0.9, "expectancy": 1.1, "pf": 1.0},
        "1d": {"trade_count": 0.8, "expectancy": 1.2, "pf": 1.0},
    }

    def __init__(self, style: str = "swing"):
        if style not in self.STYLE_BASES:
            raise ValueError(f"Unknown style: {style}. Choose from {list(self.STYLE_BASES.keys())}")
        self.style = style

    def get_thresholds(
        self,
        tier: Literal["discovery", "validation", "elite"],
        timeframe: str = "1h",
    ) -> ValidationThresholds:
        """
        Get thresholds for a specific tier and timeframe.

        Args:
            tier: Validation tier
            timeframe: Timeframe (1m, 5m, 15m, 1h, 4h, 1d, etc.)

        Returns:
            ValidationThresholds object
        """
        if tier not in ["discovery", "validation", "elite"]:
            raise ValueError(f"Unknown tier: {tier}")

        # Get base thresholds
        base = self.STYLE_BASES[self.style][tier]

        # Get multipliers for timeframe
        multiplier = self.TIMEFRAME_MULTIPLIERS.get(timeframe, {"trade_count": 1.0, "expectancy": 1.0, "pf": 1.0})

        # Apply multipliers
        adjusted = {
            "min_profit_factor": base.get("min_profit_factor", 1.0) * multiplier.get("pf", 1.0),
            "max_drawdown": base.get("max_drawdown", 1.0),
            "min_expectancy": base.get("min_expectancy", 0.0) * multiplier.get("expectancy", 1.0),
            "min_trades": int(base.get("min_trades", 50) * multiplier.get("trade_count", 1.0)),
            "min_win_rate": base.get("min_win_rate", 0.0),
            "min_oos_profit": base.get("min_oos_profit", 0.0),
            "min_robustness_score": base.get("min_robustness_score", 0.0),
            "min_walk_forward_score": base.get("min_walk_forward_score", 0.0),
        }

        return ValidationThresholds(**adjusted)

    def get_all_tiers(self, timeframe: str = "1h") -> Dict[str, ValidationThresholds]:
        """Get thresholds for all tiers"""
        return {
            "discovery": self.get_thresholds("discovery", timeframe),
            "validation": self.get_thresholds("validation", timeframe),
            "elite": self.get_thresholds("elite", timeframe),
        }


# Example usage
if __name__ == "__main__":
    # Scalping on 5m timeframe
    config = AdaptiveThresholdConfig("scalping")
    thresholds = config.get_thresholds("discovery", "5m")
    print(f"Scalping Discovery (5m): PF > {thresholds.min_profit_factor:.2f}, DD < {thresholds.max_drawdown:.1%}")

    # Swing trading on 4h timeframe
    config = AdaptiveThresholdConfig("swing")
    thresholds = config.get_thresholds("elite", "4h")
    print(f"Swing Elite (4h): PF > {thresholds.min_profit_factor:.2f}, Trades > {thresholds.min_trades}")
