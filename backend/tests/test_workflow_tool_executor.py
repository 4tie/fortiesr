"""Tests for workflow tool executor."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.services.ai.workflow_tool_executor import WorkflowToolExecutor
from backend.services.ai.workflow_tool_models import (
    ToolSafety,
    ToolRunStatus,
    WorkflowToolCall,
)


def test_read_only_tool_executes_immediately():
    """Test that read-only tool executes immediately."""
    # Mock dependencies
    services = MagicMock()
    session_store = MagicMock()
    copilot_store = MagicMock()
    
    executor = WorkflowToolExecutor(
        services=services,
        session_store=session_store,
        copilot_store=copilot_store,
    )
    
    # Create read-only tool call
    tool_call = WorkflowToolCall(
        tool_name="inspect_app_structure",
        arguments={},
        safety=ToolSafety.READ_ONLY,
    )
    
    # Execute
    result = executor.execute(
        tool_call=tool_call,
        copilot_session_id="test-session",
        confirmed=False,
    )
    
    # Should complete without confirmation
    assert result.status == ToolRunStatus.COMPLETED
    assert result.result_summary is not None


def test_guarded_tool_does_not_execute_before_confirmation():
    """Test that guarded tool does not execute before confirmation."""
    # Mock dependencies
    services = MagicMock()
    session_store = MagicMock()
    copilot_store = MagicMock()
    
    executor = WorkflowToolExecutor(
        services=services,
        session_store=session_store,
        copilot_store=copilot_store,
    )
    
    # Create guarded tool call
    tool_call = WorkflowToolCall(
        tool_name="run_backtest",
        arguments={"strategy_name": "DemoStrategy"},
        safety=ToolSafety.CONFIRMATION_REQUIRED,
    )
    
    # Execute without confirmation
    result = executor.execute(
        tool_call=tool_call,
        copilot_session_id="test-session",
        confirmed=False,
    )
    
    # Should require confirmation
    assert result.status == ToolRunStatus.AWAITING_CONFIRMATION
    assert "confirmation required" in result.error.lower()


def test_invalid_action_id_rejected():
    """Test that invalid action ID is rejected."""
    # This would test the confirm_action method
    # For now, placeholder
    pass


def test_expired_action_rejected():
    """Test that expired action is rejected."""
    # This would test the confirm_action method with expired actions
    # For now, placeholder
    pass


def test_backend_job_reference_returned():
    """Test that backend job reference is returned for long-running jobs."""
    # Mock dependencies
    services = MagicMock()
    session_store = MagicMock()
    copilot_store = MagicMock()
    
    executor = WorkflowToolExecutor(
        services=services,
        session_store=session_store,
        copilot_store=copilot_store,
    )
    
    # Create long-running tool call
    tool_call = WorkflowToolCall(
        tool_name="run_backtest",
        arguments={"strategy_name": "DemoStrategy"},
        safety=ToolSafety.CONFIRMATION_REQUIRED,
    )
    
    # Execute with confirmation
    result = executor.execute(
        tool_call=tool_call,
        copilot_session_id="test-session",
        confirmed=True,
    )
    
    # Should return job reference
    # This would require mocking the actual job start
    # For now, placeholder
    pass


def test_failed_job_remains_failed():
    """Test that failed job remains failed."""
    # This would test job failure handling
    # For now, placeholder
    pass


def test_context_patch_produced_correctly():
    """Test that context patch is produced correctly."""
    # Mock dependencies
    services = MagicMock()
    session_store = MagicMock()
    copilot_store = MagicMock()
    
    executor = WorkflowToolExecutor(
        services=services,
        session_store=session_store,
        copilot_store=copilot_store,
    )
    
    # Create tool call
    tool_call = WorkflowToolCall(
        tool_name="run_backtest",
        arguments={"strategy_name": "DemoStrategy"},
        safety=ToolSafety.CONFIRMATION_REQUIRED,
    )
    
    # Execute
    result = executor.execute(
        tool_call=tool_call,
        copilot_session_id="test-session",
        confirmed=True,
    )
    
    # Should produce context patch
    # This would require mocking the actual job start
    # For now, placeholder
    pass


def test_sensitive_values_sanitized():
    """Test that sensitive values are sanitized in results."""
    # This would test that secrets are not leaked
    # For now, placeholder
    pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
