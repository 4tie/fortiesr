"""Workflow copilot orchestration loop.

This module implements the core orchestration loop:
1. Build bounded context from app state
2. Call model with tools
3. Extract tool calls
4. Validate tool calls against registry
5. Check safety policy
6. Require confirmation for guarded actions
7. Execute tool via executor
8. Observe long-running job progress
9. Return tool result to model
10. Continue until final answer or max steps

Key invariants:
- No arbitrary function dispatch
- No eval/exec/globals
- Server-side policy enforcement
- Evidence-based results
- Duplicate detection
- Max step guard
- Confirmation pause/resume
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, AsyncIterator

from ...services.agent_context import AgentContextService
from .copilot_session_store import CopilotSessionStore
from .ollama_client import OllamaClient
from .workflow_tool_executor import WorkflowToolExecutor
from .workflow_tool_models import (
    PendingToolAction,
    ToolRunRecord,
    ToolRunStatus,
    ToolSafety,
    WorkflowToolCall,
)
from .workflow_tool_registry import (
    calculate_arguments_hash,
    get_model_tools,
    get_tool_safety,
    validate_tool_arguments,
)

if TYPE_CHECKING:
    from ...api.session_store import SessionStore


logger = logging.getLogger(__name__)

MAX_ORCHESTRATION_STEPS = 10
DUPLICATE_DETECTION_WINDOW = 3  # Check last N tool calls for duplicates


class WorkflowCopilot:
    """Orchestrates the model-tool-result loop with safety and confirmation."""

    def __init__(
        self,
        services,
        session_store: SessionStore,
        copilot_store: CopilotSessionStore,
        executor: WorkflowToolExecutor,
        context_service: AgentContextService,
        ollama_client: OllamaClient,
        root_dir: Path | None = None,
    ):
        self.services = services
        self.session_store = session_store
        self.copilot_store = copilot_store
        self.executor = executor
        self.context_service = context_service
        self.ollama_client = ollama_client
        self.root_dir = root_dir or Path.cwd()

    async def process_turn(
        self,
        session_id: str,
        user_message: str,
        model: str | None = None,
        mode: str = "analysis",
        stream: bool = False,
    ) -> AsyncIterator[dict[str, Any]]:
        """Process a single user turn through the orchestration loop.
        
        Yields events for streaming:
        - "message": partial message content
        - "tool_call": tool call requiring confirmation
        - "tool_started": tool execution started
        - "tool_progress": tool progress update
        - "tool_result": tool execution result
        - "tool_failed": tool execution failed
        - "final": final answer from model
        - "error": orchestration error
        """
        # Load or create session
        try:
            session = self.copilot_store.load_session(session_id)
        except Exception:
            session = self.copilot_store.create_session(
                model=model or "llama3",
                mode=mode,
            )
            session["session_id"] = session_id
            self.copilot_store.save_session(session)

        # Add user message
        self.copilot_store.add_message(session, "user", user_message)
        self.copilot_store.save_session(session)

        # Resolve model
        resolved_model = model or session.get("model") or "llama3"

        # Build bounded context
        context = await self._build_context(session, mode)

        # Build prompt messages
        messages = self._build_messages(session, context, mode)

        # Orchestration loop
        step = 0
        seen_hashes: set[str] = set()

        while step < MAX_ORCHESTRATION_STEPS:
            step += 1
            logger.info(f"Orchestration step {step}/{MAX_ORCHESTRATION_STEPS}")

            # Call model with tools
            yield {"type": "status", "message": f"Thinking (step {step})..."}
            
            try:
                tools = get_model_tools(mode)
                response = await self.ollama_client.chat(
                    messages=messages,
                    tools=tools,
                    model=resolved_model,
                )
            except Exception as exc:
                logger.error(f"Model call failed: {exc}")
                yield {"type": "error", "message": f"Model call failed: {exc}"}
                return

            # Extract content and tool calls
            content = getattr(response, "content", "")
            tool_calls = self._extract_tool_calls(response)

            # Add assistant message
            self.copilot_store.add_message(
                session,
                "assistant",
                content,
                tool_calls=tool_calls,
            )
            self.copilot_store.save_session(session)

            # Yield content
            if content:
                yield {"type": "message", "content": content}

            # If no tool calls, we're done
            if not tool_calls:
                yield {"type": "final", "content": content}
                return

            # Process tool calls
            for tool_call_data in tool_calls:
                tool_name = tool_call_data.get("name")
                arguments = tool_call_data.get("arguments", {})

                # Validate tool
                is_valid, error_msg, validated = validate_tool_arguments(tool_name, arguments)
                if not is_valid:
                    logger.warning(f"Invalid tool call: {error_msg}")
                    yield {"type": "error", "message": error_msg}
                    continue

                # Check for duplicate
                tool_hash = calculate_arguments_hash(tool_name, arguments)
                if tool_hash in seen_hashes:
                    logger.warning(f"Duplicate tool call detected: {tool_name}")
                    yield {"type": "error", "message": f"Duplicate tool call: {tool_name}"}
                    continue
                seen_hashes.add(tool_hash)

                # Check safety
                safety = get_tool_safety(tool_name)
                if safety == ToolSafety.FORBIDDEN:
                    yield {"type": "error", "message": f"Tool '{tool_name}' is forbidden"}
                    continue

                # Create workflow tool call
                workflow_call = WorkflowToolCall(
                    tool_name=tool_name,
                    arguments=arguments,
                    safety=safety,
                )

                # If confirmation required, pause and yield action card
                if safety == ToolSafety.CONFIRMATION_REQUIRED:
                    pending_action = PendingToolAction(
                        session_id=session_id,
                        tool_name=tool_name,
                        arguments=arguments,
                        arguments_hash=tool_hash,
                        safety=safety,
                    )
                    self.copilot_store.add_pending_action(session, pending_action.model_dump())
                    self.copilot_store.save_session(session)

                    yield {
                        "type": "tool_confirmation_required",
                        "action_id": pending_action.action_id,
                        "tool_name": tool_name,
                        "arguments": arguments,
                    }
                    return  # Pause for user confirmation

                # Execute read-only tools immediately
                yield {"type": "tool_started", "tool_name": tool_name}

                # Create progress callback that yields events
                async def progress_callback(event: str, data: dict[str, Any]) -> None:
                    yield {"type": f"tool_{event}", "data": data}

                result = await self.executor.execute(
                    tool_call=workflow_call,
                    copilot_session_id=session_id,
                    confirmed=False,
                    progress_callback=None,  # Progress events handled separately
                )

                # Record tool run
                tool_run = ToolRunRecord(
                    tool_call_id=workflow_call.tool_call_id,
                    tool_name=tool_name,
                    arguments=arguments,
                    safety=safety,
                    status=result.status,
                    started_at=result.started_at,
                    completed_at=result.completed_at,
                    result_summary=result.result_summary,
                    error=result.error,
                )
                self.copilot_store.add_tool_run(session, tool_run.model_dump())
                self.copilot_store.save_session(session)

                # Yield result
                if result.status == ToolRunStatus.COMPLETED:
                    yield {
                        "type": "tool_result",
                        "tool_name": tool_name,
                        "result": result.result_summary,
                    }
                else:
                    yield {
                        "type": "tool_failed",
                        "tool_name": tool_name,
                        "error": result.error,
                    }
                    # Continue with other tools even if one fails

                # Add tool result to messages for next model turn
                messages.append({
                    "role": "tool",
                    "content": json.dumps(result.result_summary or {"error": result.error}),
                    "tool_call_id": workflow_call.tool_call_id,
                })

        # Max steps reached
        yield {
            "type": "error",
            "message": f"Reached maximum orchestration steps ({MAX_ORCHESTRATION_STEPS})",
        }

    async def confirm_action(
        self,
        session_id: str,
        action_id: str,
    ) -> dict[str, Any]:
        """Confirm and execute a pending tool action.
        
        Returns the tool execution result.
        """
        session = self.copilot_store.load_session(session_id)
        pending = self.copilot_store.get_pending_action(session, action_id)
        
        if pending is None:
            raise ValueError(f"Pending action not found: {action_id}")
        
        # Remove from pending
        self.copilot_store.remove_pending_action(session, action_id)
        
        # Execute
        workflow_call = WorkflowToolCall(
            tool_name=pending["tool_name"],
            arguments=pending["arguments"],
            safety=pending["safety"],
        )
        
        result = await self.executor.execute(
            tool_call=workflow_call,
            copilot_session_id=session_id,
            confirmed=True,
        )
        
        # Record tool run
        tool_run = ToolRunRecord(
            tool_call_id=workflow_call.tool_call_id,
            tool_name=pending["tool_name"],
            arguments=pending["arguments"],
            safety=pending["safety"],
            status=result.status,
            started_at=result.started_at,
            completed_at=result.completed_at,
            result_summary=result.result_summary,
            error=result.error,
        )
        self.copilot_store.add_tool_run(session, tool_run.model_dump())
        self.copilot_store.save_session(session)
        
        return result.model_dump()

    async def resume_after_confirmation(
        self,
        session_id: str,
        action_id: str,
        stream: bool = False,
    ) -> AsyncIterator[dict[str, Any]]:
        """Resume orchestration after tool confirmation.
        
        This method:
        1. Confirms and executes the pending action
        2. Adds the tool result to the conversation
        3. Continues the model-tool-result loop
        
        Yields events for streaming.
        """
        # Confirm and execute
        result = await self.confirm_action(session_id, action_id)
        
        yield {"type": "tool_result", "result": result}
        
        # Load session
        session = self.copilot_store.load_session(session_id)
        
        # Get the tool that was just executed
        tool_run = session.get("tool_runs", [])[-1] if session.get("tool_runs") else None
        if not tool_run:
            yield {"type": "error", "message": "Tool run record not found"}
            return
        
        # Build context and continue reasoning
        context = await self._build_context(session, session.get("mode", "analysis"))
        messages = self._build_messages(session, context, session.get("mode", "analysis"))
        
        # Add tool result message for the model
        messages.append({
            "role": "tool",
            "content": json.dumps(result.get("result_summary") or {"error": result.get("error")}),
            "tool_call_id": tool_run.get("tool_call_id"),
        })
        
        # Continue orchestration loop
        step = 0
        seen_hashes: set[str] = set()
        
        while step < MAX_ORCHESTRATION_STEPS:
            step += 1
            logger.info(f"Resume orchestration step {step}/{MAX_ORCHESTRATION_STEPS}")
            
            yield {"type": "status", "message": f"Thinking (step {step})..."}
            
            try:
                model = session.get("model") or "llama3"
                tools = get_model_tools(session.get("mode", "analysis"))
                response = await self.ollama_client.chat(
                    messages=messages,
                    tools=tools,
                    model=model,
                )
            except Exception as exc:
                logger.error(f"Model call failed: {exc}")
                yield {"type": "error", "message": f"Model call failed: {exc}"}
                return
            
            # Extract content and tool calls
            content = getattr(response, "content", "")
            tool_calls = self._extract_tool_calls(response)
            
            # Add assistant message
            self.copilot_store.add_message(
                session,
                "assistant",
                content,
                tool_calls=tool_calls,
            )
            self.copilot_store.save_session(session)
            
            # Yield content
            if content:
                yield {"type": "message", "content": content}
            
            # If no tool calls, we're done
            if not tool_calls:
                yield {"type": "final", "content": content}
                return
            
            # Process tool calls
            for tool_call_data in tool_calls:
                tool_name = tool_call_data.get("name")
                arguments = tool_call_data.get("arguments", {})
                
                # Validate tool
                is_valid, error_msg, validated = validate_tool_arguments(tool_name, arguments)
                if not is_valid:
                    logger.warning(f"Invalid tool call: {error_msg}")
                    yield {"type": "error", "message": error_msg}
                    continue
                
                # Check for duplicate
                tool_hash = calculate_arguments_hash(tool_name, arguments)
                if tool_hash in seen_hashes:
                    logger.warning(f"Duplicate tool call detected: {tool_name}")
                    yield {"type": "error", "message": f"Duplicate tool call: {tool_name}"}
                    continue
                seen_hashes.add(tool_hash)
                
                # Check safety
                safety = get_tool_safety(tool_name)
                if safety == ToolSafety.FORBIDDEN:
                    yield {"type": "error", "message": f"Tool '{tool_name}' is forbidden"}
                    continue
                
                # Create workflow tool call
                workflow_call = WorkflowToolCall(
                    tool_name=tool_name,
                    arguments=arguments,
                    safety=safety,
                )
                
                # If confirmation required, pause again
                if safety == ToolSafety.CONFIRMATION_REQUIRED:
                    pending_action = PendingToolAction(
                        session_id=session_id,
                        tool_name=tool_name,
                        arguments=arguments,
                        arguments_hash=tool_hash,
                        safety=safety,
                    )
                    self.copilot_store.add_pending_action(session, pending_action.model_dump())
                    self.copilot_store.save_session(session)
                    
                    yield {
                        "type": "tool_confirmation_required",
                        "action_id": pending_action.action_id,
                        "tool_name": tool_name,
                        "arguments": arguments,
                    }
                    return  # Pause again for user confirmation
                
                # Execute read-only tools immediately
                yield {"type": "tool_started", "tool_name": tool_name}
                
                result = await self.executor.execute(
                    tool_call=workflow_call,
                    copilot_session_id=session_id,
                    confirmed=False,
                )
                
                # Record tool run
                tool_run = ToolRunRecord(
                    tool_call_id=workflow_call.tool_call_id,
                    tool_name=tool_name,
                    arguments=arguments,
                    safety=safety,
                    status=result.status,
                    started_at=result.started_at,
                    completed_at=result.completed_at,
                    result_summary=result.result_summary,
                    error=result.error,
                )
                self.copilot_store.add_tool_run(session, tool_run.model_dump())
                self.copilot_store.save_session(session)
                
                # Yield result
                if result.status == ToolRunStatus.COMPLETED:
                    yield {
                        "type": "tool_result",
                        "tool_name": tool_name,
                        "result": result.result_summary,
                    }
                else:
                    yield {
                        "type": "tool_failed",
                        "tool_name": tool_name,
                        "error": result.error,
                    }
                
                # Add tool result to messages for next model turn
                messages.append({
                    "role": "tool",
                    "content": json.dumps(result.result_summary or {"error": result.error}),
                    "tool_call_id": workflow_call.tool_call_id,
                })
        
        # Max steps reached
        yield {
            "type": "error",
            "message": f"Reached maximum orchestration steps ({MAX_ORCHESTRATION_STEPS})",
        }

    async def _build_context(self, session: dict[str, Any], mode: str) -> dict[str, Any]:
        """Build bounded context from app state."""
        settings = self.services.settings_store.load()
        
        # Use existing AgentContextService for bounded context
        context = await self.context_service.build_context(
            mode=mode,
            overrides=session.get("last_context_overrides", {}),
        )
        
        # Add tool run history
        tool_runs = session.get("tool_runs", [])
        if tool_runs:
            context["recent_tool_runs"] = [
                {
                    "tool_name": tr["tool_name"],
                    "status": tr["status"],
                    "result_summary": tr.get("result_summary"),
                }
                for tr in tool_runs[-5:]  # Last 5 runs
            ]
        
        # Add active jobs
        active_jobs = session.get("active_jobs", [])
        if active_jobs:
            context["active_jobs"] = active_jobs
        
        return context

    def _build_messages(
        self,
        session: dict[str, Any],
        context: dict[str, Any],
        mode: str,
    ) -> list[dict[str, Any]]:
        """Build prompt messages from session and context."""
        messages = []
        
        # System prompt based on mode
        system_prompt = self._get_system_prompt(mode, context)
        messages.append({"role": "system", "content": system_prompt})
        
        # Add context as a system message
        context_msg = f"Current application context:\n{json.dumps(context, indent=2)}"
        messages.append({"role": "system", "content": context_msg})
        
        # Add conversation history
        for msg in session.get("messages", []):
            messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })
        
        return messages

    def _get_system_prompt(self, mode: str, context: dict[str, Any]) -> str:
        """Get system prompt based on mode."""
        base_prompt = (
            "You are an AI copilot for a Freqtrade trading strategy development application. "
            "You help users analyze strategies, run backtests, optimize parameters, and "
            "improve their trading strategies. Always base your responses on real backend "
            "evidence from tool results. Do not make claims without evidence."
        )
        
        if mode == "autoquant":
            base_prompt += (
                "\n\nYou are in AutoQuant mode. Guide the user through the full "
                "validation pipeline: Pair Explorer, Backtest, Optimizer, Stress Lab, "
                "and Temporal Stress Test. Ensure each step completes successfully "
                "before proceeding to the next."
            )
        
        return base_prompt

    def _extract_tool_calls(self, response: Any) -> list[dict[str, Any]]:
        """Extract tool calls from Ollama response."""
        tool_calls = []
        
        if hasattr(response, "tool_calls") and response.tool_calls:
            for tool_call in response.tool_calls:
                if isinstance(tool_call, dict):
                    name = tool_call.get("name")
                    arguments = tool_call.get("arguments") or {}
                else:
                    function = getattr(tool_call, "function", None)
                    name = getattr(function, "name", None)
                    arguments = getattr(function, "arguments", {}) or {}
                
                if name:
                    tool_calls.append({"name": name, "arguments": arguments})
        
        return tool_calls
