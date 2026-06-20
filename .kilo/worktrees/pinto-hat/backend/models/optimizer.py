"""Systematic parameter optimizer request, session, trial, and metric models."""

from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import Field, field_validator, model_validator

from .base import (
    AcceptanceStatus,
    ParamsSchema,
    StrategyParameterDefinition,
    StrictModel,
    VersionChangeType,
    VersionCreationSource,
    VersionMetadata,
    _is_valid_timeframe,
    _is_valid_timerange,
)

# ── Systematic Optimizer (parameter search) ──────────────────────────────────

class OptimizerScoreMetric(str, Enum):
    """Backend data type for `OptimizerScoreMetric`."""
    COMPOSITE = "composite"
    TOTAL_PROFIT_PCT = "total_profit_pct"
    NET_PROFIT_ABS = "net_profit_abs"
    SHARPE_RATIO = "sharpe_ratio"
    PROFIT_FACTOR = "profit_factor"
    WIN_RATE = "win_rate"
    MAX_DRAWDOWN_PCT = "max_drawdown_pct"
    TOTAL_TRADES = "total_trades"


class SearchStrategy(str, Enum):
    """Backend data type for `SearchStrategy`."""
    RANDOM = "random"
    GRID = "grid"
    BAYESIAN = "bayesian"
    EVOLUTIONARY = "evolutionary"


class OptimizerTrialStatus(str, Enum):
    """Backend data type for `OptimizerTrialStatus`."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PRUNED = "pruned"


class OptimizerSessionPhase(str, Enum):
    """Backend data type for `OptimizerSessionPhase`."""
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ParameterSearchType(str, Enum):
    """Backend data type for `ParameterSearchType`."""
    INT = "int"
    DECIMAL = "decimal"
    CATEGORICAL = "categorical"
    BOOLEAN = "boolean"


class ParameterSearchSpace(StrictModel):
    """Backend data type for `ParameterSearchSpace`."""
    name: str
    param_type: ParameterSearchType
    space: str | None = None
    default: Any = None
    enabled: bool = True
    # For int/decimal
    min_value: float | None = None
    max_value: float | None = None
    step: float | None = None
    # For categorical/boolean
    choices: list[Any] | None = None
    # Conditional dependency: only sample this space when another parameter has the expected value.
    depends_on: str | None = None
    depends_on_value: Any | None = None


class OptimizerScoreWeights(StrictModel):
    """Backend data type for `OptimizerScoreWeights`."""
    net_profit_pct: float = 0.35
    net_profit_abs: float = 0.0
    sharpe_ratio: float = 0.25
    profit_factor: float = 0.20
    win_rate_pct: float = 0.0
    max_drawdown_pct: float = 0.20
    total_trades: float = 0.0


class OptimizerSessionConfig(StrictModel):
    """Backend data type for `OptimizerSessionConfig`."""
    strategy_name: str
    timeframe: str
    timerange: str
    pairs: list[str]
    config_file: str
    dry_run_wallet: float = 1000.0
    max_open_trades: int = 1
    fee_rate: float = 0.001
    total_trials: int = 50
    search_strategy: SearchStrategy = SearchStrategy.RANDOM
    score_metric: OptimizerScoreMetric = OptimizerScoreMetric.COMPOSITE
    score_weights: OptimizerScoreWeights = Field(default_factory=OptimizerScoreWeights)
    target_trades: int | None = None
    target_profit_pct: float | None = None
    max_drawdown_pct: float | None = None
    target_romad: float | None = None
    search_spaces: list[ParameterSearchSpace] = Field(default_factory=list)


class OptimizerTrialMetrics(StrictModel):
    """Backend data type for `OptimizerTrialMetrics`."""
    net_profit_pct: float | None = None
    net_profit_abs: float | None = None
    win_rate_pct: float | None = None
    max_drawdown_pct: float | None = None
    total_trades: int | None = None
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    score: float | None = None


class OptimizerTrial(StrictModel):
    """Backend data type for `OptimizerTrial`."""
    trial_number: int
    status: OptimizerTrialStatus
    parameters: dict[str, Any]
    metrics: OptimizerTrialMetrics | None = None
    run_id: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None
    is_best: bool = False


class OptimizerSession(StrictModel):
    """Backend data type for `OptimizerSession`."""
    session_id: str
    strategy_name: str
    config: OptimizerSessionConfig
    phase: OptimizerSessionPhase
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    total_trials: int
    completed_trials: int = 0
    failed_trials: int = 0
    elapsed_seconds: float = 0.0
    eta_seconds: float | None = None
    best_trial_number: int | None = None
    best_metrics: OptimizerTrialMetrics | None = None
    trials: list[OptimizerTrial] = Field(default_factory=list)
    stop_reason: str | None = None


class OptimizerSessionSummary(StrictModel):
    """Backend data type for `OptimizerSessionSummary`."""
    session_id: str
    strategy_name: str
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    phase: OptimizerSessionPhase
    total_trials: int
    completed_trials: int
    best_score: float | None = None
    score_metric: OptimizerScoreMetric


class AdvancedOptimizerConfig(StrictModel):
    """Backend data type for `AdvancedOptimizerConfig`."""
    enable_stoploss: bool = False
    enable_roi: bool = False
    enable_trailing: bool = False


class StartOptimizerRequest(StrictModel):
    """Backend data type for `StartOptimizerRequest`."""
    strategy_name: str
    timeframe: str
    timerange: str
    pairs: list[str]
    config_file: str
    dry_run_wallet: float = 1000.0
    max_open_trades: int = 1
    fee_rate: float = 0.001
    total_trials: int = 50
    search_strategy: SearchStrategy = SearchStrategy.RANDOM
    score_metric: OptimizerScoreMetric = OptimizerScoreMetric.COMPOSITE
    score_weights: OptimizerScoreWeights = Field(default_factory=OptimizerScoreWeights)
    target_trades: int | None = None
    target_profit_pct: float | None = None
    max_drawdown_pct: float | None = None
    target_romad: float | None = None
    search_spaces: list[ParameterSearchSpace] = Field(default_factory=list)
    advanced_config: AdvancedOptimizerConfig | None = None

    @field_validator("total_trials")
    @classmethod
    def validate_total_trials(cls, value: int) -> int:
        """Validate or transform `validate_total_trials` input before the model is accepted."""
        if value < 1 or value > 500:
            raise ValueError("total_trials must be between 1 and 500.")
        return value

    @field_validator("timerange", mode="before")
    @classmethod
    def validate_timerange(cls, value: Any) -> str:
        """Validate or transform `validate_timerange` input before the model is accepted."""
        text = str(value or "").strip()
        if not text:
            raise ValueError("timerange is required.")
        if not _is_valid_timerange(text):
            raise ValueError("timerange must look like YYYYMMDD-YYYYMMDD.")
        return text

    @field_validator("timeframe", mode="before")
    @classmethod
    def validate_timeframe(cls, value: Any) -> str:
        """Validate or transform `validate_timeframe` input before the model is accepted."""
        text = str(value or "").strip()
        if not text:
            raise ValueError("timeframe is required.")
        if not _is_valid_timeframe(text):
            raise ValueError("timeframe must look like 5m, 1h, 1d.")
        return text

    @model_validator(mode="after")
    def validate_advanced_search_spaces(self) -> "StartOptimizerRequest":
        """Validate or transform `validate_advanced_search_spaces` input before the model is accepted."""
        for sp in self.search_spaces:
            if not sp.enabled:
                continue
            if sp.name == "stoploss__value":
                if sp.max_value is not None and sp.max_value >= 0.0:
                    raise ValueError("Stoploss must be negative")
            elif sp.name.startswith("roi__"):
                if sp.min_value is not None and sp.min_value <= 0.0:
                    raise ValueError(
                        f"ROI min_value for {sp.name} must be positive"
                    )
        # Cross-space trailing constraint
        trailing_positive_sp = next(
            (s for s in self.search_spaces if s.name == "trailing__positive" and s.enabled),
            None,
        )
        trailing_offset_sp = next(
            (s for s in self.search_spaces if s.name == "trailing__offset" and s.enabled),
            None,
        )
        if trailing_positive_sp and trailing_offset_sp:
            tp_max = trailing_positive_sp.max_value or 0.10
            to_min = trailing_offset_sp.min_value or 0.001
            if to_min >= tp_max:
                raise ValueError(
                    "Trailing offset must be less than trailing positive"
                )
        return self


class ExportBestTrialRequest(StrictModel):
    """Backend data type for `ExportBestTrialRequest`."""
    session_id: str
    trial_number: int | None = None  # None = use best_trial_number
