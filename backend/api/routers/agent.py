"""Router: /api/agent/* read-only observability endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict

from ...core.errors import BackendError
from ...services.agent_context import AgentContextService

router = APIRouter(prefix="/api/agent", tags=["Agent Observability"])


class AgentUiStatePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    active_tab: str | None = None
    active_panel: str | None = None
    strategy_name: str | None = None
    auto_quant_run_id: str | None = None
    optimizer_session_id: str | None = None
    optimizer_trial_number: int | None = None
    backtest_run_id: str | None = None
    api_session_id: str | None = None


def _service(request: Request) -> AgentContextService:
    services = request.app.state.services
    return AgentContextService(
        root_dir=services.root_dir,
        run_repository=services.run_repository,
        settings_store=services.settings_store,
        version_manager=services.version_manager,
        strategy_optimizer=getattr(services, "strategy_optimizer", None),
        backtest_runner=services.backtest_runner,
        optimizer_store=getattr(services, "optimizer_store", None),
        run_detail_callable=services.run_detail,
        log_broadcaster=getattr(request.app.state, "log_broadcaster", None),
        session_store=getattr(request.app.state, "session_store", None),
    )


def _raise_backend(exc: BackendError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post(
    "/ui-state",
    summary="Persist the frontend agent heartbeat",
    description="Stores the active tab, active panel, selected strategy, and active run IDs.",
)
async def update_agent_ui_state(body: AgentUiStatePayload, request: Request) -> dict[str, Any]:
    payload = body.model_dump(mode="json", exclude_unset=True)
    return _service(request).save_ui_state(payload)


@router.get(
    "/context",
    summary="Return the complete read-only agent context snapshot",
)
async def get_agent_context(
    request: Request,
    active_tab: str | None = Query(default=None),
    active_panel: str | None = Query(default=None),
    strategy_name: str | None = Query(default=None),
    auto_quant_run_id: str | None = Query(default=None),
    optimizer_session_id: str | None = Query(default=None),
    optimizer_trial_number: int | None = Query(default=None),
    backtest_run_id: str | None = Query(default=None),
    api_session_id: str | None = Query(default=None),
) -> dict[str, Any]:
    overrides = {
        "active_tab": active_tab,
        "active_panel": active_panel,
        "strategy_name": strategy_name,
        "auto_quant_run_id": auto_quant_run_id,
        "optimizer_session_id": optimizer_session_id,
        "optimizer_trial_number": optimizer_trial_number,
        "backtest_run_id": backtest_run_id,
        "api_session_id": api_session_id,
    }
    return _service(request).build_context(overrides)


@router.get(
    "/runs/auto-quant/{run_id}",
    summary="Return an AutoQuant observability snapshot",
)
async def get_agent_auto_quant_run(run_id: str, request: Request) -> dict[str, Any]:
    try:
        return _service(request).auto_quant_run_context(run_id)
    except BackendError as exc:
        _raise_backend(exc)


@router.get(
    "/runs/optimizer/{session_id}",
    summary="Return an optimizer observability snapshot",
)
async def get_agent_optimizer_run(
    session_id: str,
    request: Request,
    optimizer_trial_number: int | None = Query(default=None),
) -> dict[str, Any]:
    try:
        return _service(request).optimizer_run_context(
            session_id,
            trial_number=optimizer_trial_number,
        )
    except BackendError as exc:
        _raise_backend(exc)


@router.get(
    "/runs/backtest/{run_id}",
    summary="Return a backtest observability snapshot",
)
async def get_agent_backtest_run(run_id: str, request: Request) -> dict[str, Any]:
    try:
        return _service(request).backtest_run_context(run_id)
    except BackendError as exc:
        _raise_backend(exc)


@router.get(
    "/files/strategy/{strategy_name}",
    summary="Return allowlisted strategy file content for the agent",
)
async def get_agent_strategy_files(strategy_name: str, request: Request) -> dict[str, Any]:
    try:
        return _service(request).strategy_file_context(strategy_name, include_content=True)
    except BackendError as exc:
        _raise_backend(exc)
