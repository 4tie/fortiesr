"""
AutoQuant Service - Orchestrates the complete strategy evaluation pipeline
Coordinates: Strategy input → Discovery → Validation → Elite Validation → Ranking
"""

import uuid
from datetime import datetime
from typing import List, Tuple, Optional
import asyncio

from ..models.domain.strategy import Strategy, PipelineRun, EliteScore
from ..core.config import ThresholdConfig
from ..engine.discovery_engine import DiscoveryEngine
from ..engine.validation_engine import ValidationEngine
from ..engine.elite_validation_engine import EliteValidationEngine
from ..engine.elite_ranking_engine import EliteRankingEngine


class AutoQuantService:
    """Orchestrates the complete AutoQuant pipeline"""

    def __init__(self, strategy_type: str = "swing"):
        self.strategy_type = strategy_type
        self.config = ThresholdConfig(strategy_type)

        # Initialize engines with thresholds
        self.discovery_engine = DiscoveryEngine(
            self.config.get_discovery_thresholds()
        )
        self.validation_engine = ValidationEngine(
            self.config.get_validation_thresholds()
        )
        self.elite_validation_engine = EliteValidationEngine(
            self.config.get_elite_thresholds()
        )
        self.elite_ranking_engine = EliteRankingEngine()

        # In-memory storage of pipeline runs
        self.runs: dict[str, PipelineRun] = {}

    async def start_pipeline(self, strategy: Strategy) -> str:
        """
        Start a new pipeline execution for a strategy.

        Args:
            strategy: Strategy to evaluate

        Returns:
            run_id: Unique identifier for this pipeline run
        """
        run_id = str(uuid.uuid4())

        run = PipelineRun(
            run_id=run_id,
            strategy_id=strategy.id,
            strategy_name=strategy.name,
            status="running",
            current_stage="discovery",
            progress=0,
            started_at=datetime.now(),
        )

        self.runs[run_id] = run

        # Fire-and-forget: execute pipeline in background
        asyncio.create_task(self._execute_pipeline(run, strategy))

        return run_id

    async def _execute_pipeline(self, run: PipelineRun, strategy: Strategy) -> None:
        """
        Execute the complete pipeline stages sequentially.

        Args:
            run: PipelineRun tracking object
            strategy: Strategy to evaluate
        """
        try:
            # Stage 1: Discovery (0-25%)
            run.current_stage = "discovery"
            run.progress = 5
            candidates, discovery_errors = await self._run_discovery(strategy)

            if not candidates:
                run.status = "failed"
                run.errors.append("No strategies passed discovery stage")
                run.completed_at = datetime.now()
                return

            run.candidates = candidates
            run.progress = 25

            # Stage 2: Validation (25-50%)
            run.current_stage = "validation"
            run.progress = 30
            promising, validation_errors = await self._run_validation(candidates)

            if not promising:
                run.status = "failed"
                run.errors.append("No strategies passed validation stage")
                run.completed_at = datetime.now()
                return

            run.promising = promising
            run.progress = 50

            # Stage 3: Elite Validation (50-75%)
            run.current_stage = "elite_validation"
            run.progress = 55
            validated, elite_validation_errors = await self._run_elite_validation(
                promising
            )

            if not validated:
                run.status = "failed"
                run.errors.append("No strategies passed elite validation stage")
                run.completed_at = datetime.now()
                return

            run.validated = validated
            run.progress = 75

            # Stage 4: Elite Ranking (75-100%)
            run.current_stage = "ranking"
            run.progress = 80
            ranked, scores = await self._run_ranking(validated)

            run.elite = ranked
            run.progress = 100
            run.status = "completed"
            run.completed_at = datetime.now()

        except Exception as e:
            run.status = "failed"
            run.errors.append(f"Pipeline error: {str(e)}")
            run.completed_at = datetime.now()

    async def _run_discovery(self, strategy: Strategy) -> Tuple[List[Strategy], List[str]]:
        """Run discovery stage asynchronously"""
        return await asyncio.to_thread(
            self.discovery_engine.discover,
            [strategy]
        )

    async def _run_validation(
        self, candidates: List[Strategy]
    ) -> Tuple[List[Strategy], List[str]]:
        """Run validation stage asynchronously"""
        return await asyncio.to_thread(
            self.validation_engine.validate,
            candidates
        )

    async def _run_elite_validation(
        self, promising: List[Strategy]
    ) -> Tuple[List[Strategy], List[str]]:
        """Run elite validation stage asynchronously"""
        return await asyncio.to_thread(
            self.elite_validation_engine.validate,
            promising
        )

    async def _run_ranking(
        self, validated: List[Strategy]
    ) -> Tuple[List[Strategy], List[EliteScore]]:
        """Run ranking stage asynchronously"""
        return await asyncio.to_thread(
            self.elite_ranking_engine.rank,
            validated
        )

    def get_run(self, run_id: str) -> Optional[PipelineRun]:
        """
        Get pipeline run by ID.

        Args:
            run_id: Pipeline run identifier

        Returns:
            PipelineRun object or None
        """
        return self.runs.get(run_id)

    def list_runs(self) -> List[PipelineRun]:
        """
        List all pipeline runs (most recent first).

        Returns:
            List of PipelineRun objects
        """
        return sorted(
            self.runs.values(),
            key=lambda r: r.started_at or datetime.now(),
            reverse=True
        )

    def cancel_run(self, run_id: str) -> bool:
        """
        Cancel a running pipeline.

        Args:
            run_id: Pipeline run identifier

        Returns:
            True if cancelled, False if not found or already completed
        """
        run = self.runs.get(run_id)
        if not run or run.status in ("completed", "failed"):
            return False

        run.status = "failed"
        run.errors.append("Pipeline cancelled by user")
        run.completed_at = datetime.now()
        return True
