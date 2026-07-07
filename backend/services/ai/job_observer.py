"""Job observer for monitoring long-running workflow jobs.

This module provides bounded polling for observing job progress
without busy loops, with proper timeout handling.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, AsyncIterator

if TYPE_CHECKING:
    from ...api.session_store import SessionStore


logger = logging.getLogger(__name__)

# Polling intervals (bounded to avoid busy loops)
INITIAL_POLL_INTERVAL = 1.0  # seconds
MAX_POLL_INTERVAL = 5.0  # seconds
POLL_BACKOFF_MULTIPLIER = 1.5

# Observation timeout
DEFAULT_OBSERVATION_TIMEOUT = 300  # 5 minutes


async def observe_job(
    session_store: SessionStore,
    api_session_id: str,
    job_type: str = "backtest",
    timeout: int = DEFAULT_OBSERVATION_TIMEOUT,
) -> AsyncIterator[dict[str, Any]]:
    """Observe a long-running job and emit progress events.
    
    Args:
        session_store: SessionStore for job tracking
        api_session_id: API session ID of the job
        job_type: Type of job (backtest, optimizer, etc.)
        timeout: Maximum observation time in seconds
    
    Yields:
        Progress events with status and job data
    """
    poll_interval = INITIAL_POLL_INTERVAL
    start_time = datetime.now(tz=UTC)
    
    while True:
        # Check timeout
        elapsed = (datetime.now(tz=UTC) - start_time).total_seconds()
        if elapsed > timeout:
            yield {
                "type": "observation_timeout",
                "api_session_id": api_session_id,
                "job_type": job_type,
                "elapsed_seconds": elapsed,
            }
            return
        
        # Get current job state
        try:
            record = session_store.get(api_session_id)
        except Exception as exc:
            logger.error(f"Failed to get job state: {exc}")
            yield {
                "type": "error",
                "api_session_id": api_session_id,
                "error": str(exc),
            }
            return
        
        status = record.status
        result = record.result or {}
        
        # Emit progress event
        yield {
            "type": "job_progress",
            "api_session_id": api_session_id,
            "job_type": job_type,
            "status": status,
            "result": result,
            "started_at": record.started_at,
            "completed_at": record.completed_at,
        }
        
        # Check if terminal
        if status in ("completed", "failed", "cancelled"):
            logger.info(f"Job {api_session_id} reached terminal status: {status}")
            return
        
        # Backoff poll interval
        poll_interval = min(
            poll_interval * POLL_BACKOFF_MULTIPLIER,
            MAX_POLL_INTERVAL
        )
        
        # Wait before next poll
        await asyncio.sleep(poll_interval)


async def observe_optimizer_job(
    services,
    api_session_id: str,
    optimizer_session_id: str,
    timeout: int = DEFAULT_OBSERVATION_TIMEOUT,
) -> AsyncIterator[dict[str, Any]]:
    """Observe an optimizer job using the optimizer store.
    
    Args:
        services: App services container
        api_session_id: API session ID
        optimizer_session_id: Internal optimizer session ID
        timeout: Maximum observation time in seconds
    
    Yields:
        Progress events with optimizer-specific data
    """
    poll_interval = INITIAL_POLL_INTERVAL
    start_time = datetime.now(tz=UTC)
    
    while True:
        # Check timeout
        elapsed = (datetime.now(tz=UTC) - start_time).total_seconds()
        if elapsed > timeout:
            yield {
                "type": "observation_timeout",
                "api_session_id": api_session_id,
                "optimizer_session_id": optimizer_session_id,
                "elapsed_seconds": elapsed,
            }
            return
        
        # Get optimizer session state
        try:
            optimizer_session = services.optimizer_store.load_session(optimizer_session_id)
        except Exception as exc:
            logger.error(f"Failed to get optimizer session: {exc}")
            yield {
                "type": "error",
                "api_session_id": api_session_id,
                "optimizer_session_id": optimizer_session_id,
                "error": str(exc),
            }
            return
        
        if optimizer_session is None:
            yield {
                "type": "error",
                "api_session_id": api_session_id,
                "optimizer_session_id": optimizer_session_id,
                "error": "Optimizer session not found",
            }
            return
        
        # Extract progress data using actual OptimizerSession model fields
        phase = optimizer_session.phase
        total_trials = optimizer_session.total_trials
        completed_trials = optimizer_session.completed_trials
        failed_trials = optimizer_session.failed_trials
        best_trial_number = optimizer_session.best_trial_number
        best_metrics = optimizer_session.best_metrics
        stop_reason = optimizer_session.stop_reason
        
        yield {
            "type": "optimizer_progress",
            "api_session_id": api_session_id,
            "optimizer_session_id": optimizer_session_id,
            "phase": phase,
            "total_trials": total_trials,
            "completed_trials": completed_trials,
            "failed_trials": failed_trials,
            "best_trial_number": best_trial_number,
            "best_metrics": best_metrics.model_dump() if best_metrics else None,
            "stop_reason": stop_reason,
        }
        
        # Check if terminal (phase is terminal)
        if phase in ("completed", "failed", "cancelled"):
            logger.info(f"Optimizer {optimizer_session_id} reached terminal phase: {phase}")
            return
        
        # Backoff poll interval
        poll_interval = min(
            poll_interval * POLL_BACKOFF_MULTIPLIER,
            MAX_POLL_INTERVAL
        )
        
        # Wait before next poll
        await asyncio.sleep(poll_interval)
