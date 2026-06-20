"""Scoring module for AutoQuant robustness-first workflow.

This module computes final strategy scores, validation status, and readiness labels
using policy-driven weights and thresholds.
"""

from __future__ import annotations

import logging
from typing import Any

from ..policy import load_policy
from .logging import _rlog


def compute_score(
    run_id: str,
    state: Any,
    metrics: dict[str, Any],
) -> dict[str, Any]:
    """Compute final strategy score using policy weights.
    
    Args:
        run_id: Pipeline run identifier
        state: PipelineState instance
        metrics: Dictionary of performance metrics from pipeline stages
        
    Returns:
        Dictionary with:
        - score: Final score (0-100)
        - score_explanation: Detailed breakdown of score components
        - validation_status: "passed", "failed", or "candidate"
        - readiness_label: Readiness label from policy
    """
    policy = load_policy()
    
    # Extract metrics
    expectancy = metrics.get("expectancy", 0.0)
    profit_factor = metrics.get("profit_factor", 1.0)
    drawdown = metrics.get("max_drawdown", 0.5)
    robustness_score = metrics.get("robustness_score", 0.5)
    oos_retention = metrics.get("oos_retention", 0.5)
    walk_forward_score = metrics.get("walk_forward_score", 0.5)
    pair_consistency = metrics.get("pair_consistency", 0.5)
    
    # Get score weights from policy
    weights = policy.score_weights()
    
    # Normalize metrics to 0-1 scale
    expectancy_norm = min(expectancy * 1000, 1.0)  # Expectancy typically small
    profit_factor_norm = min(profit_factor / 3.0, 1.0)  # PF of 3.0 is excellent
    drawdown_norm = max(0, 1.0 - drawdown)  # Lower drawdown is better
    robustness_norm = robustness_score
    oos_norm = oos_retention
    walk_forward_norm = walk_forward_score
    pair_consistency_norm = pair_consistency
    
    # Compute weighted score
    score = (
        expectancy_norm * weights.get("expectancy", 0.25) +
        profit_factor_norm * weights.get("profit_factor", 0.20) +
        drawdown_norm * weights.get("drawdown", 0.15) +
        robustness_norm * weights.get("robustness", 0.15) +
        oos_norm * weights.get("oos", 0.10) +
        walk_forward_norm * weights.get("walk_forward", 0.10) +
        pair_consistency_norm * weights.get("pair_consistency", 0.05)
    )
    
    # Convert to 0-100 scale
    score_100 = score * 100
    
    # Build score explanation
    score_explanation = {
        "components": {
            "expectancy": {
                "value": expectancy,
                "normalized": expectancy_norm,
                "weight": weights.get("expectancy", 0.25),
                "contribution": expectancy_norm * weights.get("expectancy", 0.25) * 100,
            },
            "profit_factor": {
                "value": profit_factor,
                "normalized": profit_factor_norm,
                "weight": weights.get("profit_factor", 0.20),
                "contribution": profit_factor_norm * weights.get("profit_factor", 0.20) * 100,
            },
            "drawdown": {
                "value": drawdown,
                "normalized": drawdown_norm,
                "weight": weights.get("drawdown", 0.15),
                "contribution": drawdown_norm * weights.get("drawdown", 0.15) * 100,
            },
            "robustness": {
                "value": robustness_score,
                "normalized": robustness_norm,
                "weight": weights.get("robustness", 0.15),
                "contribution": robustness_norm * weights.get("robustness", 0.15) * 100,
            },
            "oos": {
                "value": oos_retention,
                "normalized": oos_norm,
                "weight": weights.get("oos", 0.10),
                "contribution": oos_norm * weights.get("oos", 0.10) * 100,
            },
            "walk_forward": {
                "value": walk_forward_score,
                "normalized": walk_forward_norm,
                "weight": weights.get("walk_forward", 0.10),
                "contribution": walk_forward_norm * weights.get("walk_forward", 0.10) * 100,
            },
            "pair_consistency": {
                "value": pair_consistency,
                "normalized": pair_consistency_norm,
                "weight": weights.get("pair_consistency", 0.05),
                "contribution": pair_consistency_norm * weights.get("pair_consistency", 0.05) * 100,
            },
        },
        "final_score": score_100,
        "weights_used": weights,
    }
    
    # Determine validation status
    validation_status = determine_validation_status(state, metrics, score_100)
    
    # Get readiness label from policy
    readiness_label = policy.readiness_for_score(score_100)
    
    _rlog(run_id, 5, logging.INFO,
          f"Score Computation | Score={score_100:.1f}/100 | Status={validation_status} | Readiness={readiness_label}")
    
    return {
        "score": score_100,
        "score_explanation": score_explanation,
        "validation_status": validation_status,
        "readiness_label": readiness_label,
    }


def determine_validation_status(
    state: Any,
    metrics: dict[str, Any],
    score: float,
) -> str:
    """Determine validation status based on metrics and score.
    
    Args:
        state: PipelineState instance
        metrics: Dictionary of performance metrics
        score: Final score (0-100)
        
    Returns:
        Validation status: "passed", "failed", or "candidate"
    """
    # Check if any stage failed
    for stage in state.stages:
        if stage.status == "failed":
            return "failed"
    
    # Check if validation notes indicate critical issues
    critical_notes = [note for note in state.validation_notes if "critical" in note.lower() or "failed" in note.lower()]
    if critical_notes:
        return "failed"
    
    # Check score thresholds
    if score >= 70:
        return "passed"
    elif score >= 50:
        return "candidate"
    else:
        return "failed"


def aggregate_validation_notes(state: Any) -> list[str]:
    """Aggregate all validation notes from pipeline stages.
    
    Args:
        state: PipelineState instance
        
    Returns:
        List of validation notes
    """
    notes = list(state.validation_notes)
    
    # Add notes from stages if available
    for stage in state.stages:
        if stage.message and "warning" in stage.message.lower():
            notes.append(f"Stage {stage.index}: {stage.message}")
    
    return notes


__all__ = [
    "compute_score",
    "determine_validation_status",
    "aggregate_validation_notes",
]
