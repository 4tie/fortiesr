from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.routers.ai_assistant import router
from backend.models import (
    OptimizerScoreMetric,
    OptimizerSession,
    OptimizerSessionConfig,
    OptimizerSessionPhase,
    OptimizerTrial,
    OptimizerTrialMetrics,
    OptimizerTrialStatus,
)
from backend.services.storage.optimizer_store import OptimizerStore
from backend.utils import read_json


class DummyResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self.payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self.payload


class DummyAsyncClient:
    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def post(self, *args, **kwargs):
        return DummyResponse({"message": {"content": "Fact: the backend context has no profit metric selected yet."}})


def _client(tmp_path: Path, *, model: str = "llama3"):
    app = FastAPI()
    app.include_router(router)

    user_data = tmp_path / "user_data"
    strategies = user_data / "strategies"
    user_data.mkdir(parents=True, exist_ok=True)
    strategies.mkdir(parents=True, exist_ok=True)

    settings = SimpleNamespace(
        ollama_api_url="http://localhost:11434",
        ollama_model=model,
        ollama_provider="local",
        ollama_api_key="",
        ollama_timeout=30,
        user_data_directory_path=str(user_data),
        strategies_directory_path=str(strategies),
    )
    services = MagicMock()
    services.root_dir = tmp_path
    services.settings_store.load.return_value = settings
    services.optimizer_store = OptimizerStore(user_data / "optimizer_sessions")
    services.strategy_optimizer.get_active_session_id.return_value = None
    services.backtest_runner.get_current_run_id.return_value = None
    services.run_detail.side_effect = Exception("no runs")

    app.state.services = services
    app.state.log_broadcaster = MagicMock(history=[])
    app.state.session_store = MagicMock()
    app.state.session_store.get.return_value = None
    return TestClient(app), services, user_data


def test_chat_uses_ollama_and_persists_session(tmp_path):
    client, _, user_data = _client(tmp_path)

    with patch("backend.services.assistant_service.httpx.AsyncClient", DummyAsyncClient):
        response = client.post("/api/ai/chat", json={"message": "Why is this losing?"})

    assert response.status_code == 200
    body = response.json()
    assert body["message"]["content"].startswith("Fact:")
    assert body["session_id"]

    stored = read_json(user_data / "assistant" / "chat_sessions" / f"{body['session_id']}.json")
    assert stored["schema_version"] == "assistant_chat_session_v1"
    assert [item["role"] for item in stored["messages"]] == ["user", "assistant"]

    loaded = client.get(f"/api/ai/chat/{body['session_id']}")
    assert loaded.status_code == 200
    assert loaded.json()["session_id"] == body["session_id"]


def test_chat_requires_configured_model(tmp_path):
    client, _, _ = _client(tmp_path, model="")

    response = client.post("/api/ai/chat", json={"message": "Hello"})

    assert response.status_code == 422
    assert "No AI model configured" in response.json()["detail"]


def test_dangerous_action_is_rejected_and_audited(tmp_path):
    client, _, user_data = _client(tmp_path)

    response = client.post(
        "/api/ai/actions/confirm",
        json={"action_type": "overwrite_accepted_params", "payload": {"strategy_name": "Demo"}},
    )

    assert response.status_code == 403
    audit_lines = (user_data / "assistant" / "audit.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(audit_lines) == 1
    entry = json.loads(audit_lines[0])
    assert entry["status"] == "rejected"
    assert entry["proposed_action"]["action_type"] == "overwrite_accepted_params"


def test_read_only_view_best_params_action_is_audited(tmp_path):
    client, services, user_data = _client(tmp_path)
    session = OptimizerSession(
        session_id="opt-1",
        strategy_name="DemoStrategy",
        config=OptimizerSessionConfig(
            strategy_name="DemoStrategy",
            timeframe="1h",
            timerange="20240101-20240201",
            pairs=["BTC/USDT"],
            config_file="config.json",
            score_metric=OptimizerScoreMetric.COMPOSITE,
        ),
        phase=OptimizerSessionPhase.COMPLETED,
        created_at="2026-06-15T00:00:00Z",
        completed_at="2026-06-15T00:01:00Z",
        total_trials=1,
        completed_trials=1,
        best_trial_number=1,
        best_metrics=OptimizerTrialMetrics(score=1.25, profit_factor=1.8),
        trials=[
            OptimizerTrial(
                trial_number=1,
                status=OptimizerTrialStatus.COMPLETED,
                parameters={"buy__window": 14, "stoploss__value": -0.04},
                metrics=OptimizerTrialMetrics(score=1.25, profit_factor=1.8),
            )
        ],
    )
    services.optimizer_store.save_session(session)

    response = client.post(
        "/api/ai/actions/confirm",
        json={"action_type": "view_best_params", "payload": {"optimizer_session_id": "opt-1"}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["read_only"] is True
    assert body["params"]["params"]["buy"]["window"] == 14

    audit_lines = (user_data / "assistant" / "audit.jsonl").read_text(encoding="utf-8").splitlines()
    assert json.loads(audit_lines[-1])["status"] == "completed"


def test_guarded_action_requires_confirmation_token(tmp_path):
    client, _, user_data = _client(tmp_path)

    response = client.post(
        "/api/ai/actions/confirm",
        json={
            "action_type": "promote_best_trial_to_candidate",
            "payload": {"optimizer_session_id": "opt-1"},
            "confirmation_token": None,
        },
    )

    assert response.status_code == 409
    assert "Confirmation token required" in response.json()["detail"]


def test_guarded_action_succeeds_with_confirmation(tmp_path):
    client, services, user_data = _client(tmp_path)
    session = OptimizerSession(
        session_id="opt-1",
        strategy_name="DemoStrategy",
        config=OptimizerSessionConfig(
            strategy_name="DemoStrategy",
            timeframe="1h",
            timerange="20240101-20240201",
            pairs=["BTC/USDT"],
            config_file="config.json",
            score_metric=OptimizerScoreMetric.COMPOSITE,
        ),
        phase=OptimizerSessionPhase.COMPLETED,
        created_at="2026-06-15T00:00:00Z",
        completed_at="2026-06-15T00:01:00Z",
        total_trials=1,
        completed_trials=1,
        best_trial_number=1,
        best_metrics=OptimizerTrialMetrics(score=1.25, profit_factor=1.8),
        trials=[
            OptimizerTrial(
                trial_number=1,
                status=OptimizerTrialStatus.COMPLETED,
                parameters={"buy__window": 14},
                metrics=OptimizerTrialMetrics(score=1.25, profit_factor=1.8),
                run_id="bt-001",
            )
        ],
    )
    services.optimizer_store.save_session(session)

    response = client.post(
        "/api/ai/actions/confirm",
        json={
            "action_type": "promote_best_trial_to_candidate",
            "payload": {"optimizer_session_id": "opt-1"},
            "confirmation_token": "CONFIRM",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True

    audit_lines = (user_data / "assistant" / "audit.jsonl").read_text(encoding="utf-8").splitlines()
    assert json.loads(audit_lines[-1])["status"] == "completed"


def test_unknown_action_returns_400_error(tmp_path):
    client, _, _ = _client(tmp_path)

    response = client.post(
        "/api/ai/actions/confirm",
        json={"action_type": "unknown_action", "payload": {}},
    )

    assert response.status_code == 400
    assert "Unknown assistant action" in response.json()["detail"]


def test_chat_with_context_overrides_includes_context_in_prompt(tmp_path):
    client, _, user_data = _client(tmp_path)

    with patch("backend.services.assistant_service.httpx.AsyncClient", DummyAsyncClient):
        response = client.post(
            "/api/ai/chat",
            json={
                "message": "Explain this run",
                "context_overrides": {"optimizer_session_id": "opt-1"},
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"]
    assert body["context_summary"]


def test_models_endpoint_handles_ollama_connect_error(tmp_path):
    client, _, _ = _client(tmp_path, model="llama3")

    # Simulate connection error by using an invalid URL
    with patch("httpx.AsyncClient.get") as mock_get:
        import httpx
        mock_get.side_effect = httpx.ConnectError("Connection refused")

        response = client.get("/api/ai/models")

    assert response.status_code == 200
    body = response.json()
    assert body["reachable"] is False
    assert "Could not connect to Ollama" in body["error"]


def test_models_endpoint_handles_ollama_timeout(tmp_path):
    client, _, _ = _client(tmp_path, model="llama3")

    # Simulate timeout
    with patch("httpx.AsyncClient.get") as mock_get:
        import httpx
        mock_get.side_effect = httpx.TimeoutException("Request timed out")

        response = client.get("/api/ai/models")

    assert response.status_code == 200
    body = response.json()
    assert body["reachable"] is False
    assert "Ollama did not respond within" in body["error"]


def test_models_endpoint_handles_malformed_json(tmp_path):
    client, _, _ = _client(tmp_path, model="llama3")

    class DummyResponse:
        def __init__(self):
            self.status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            raise json.JSONDecodeError("Invalid JSON", "", 0)

    class DummyClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, *args, **kwargs):
            return DummyResponse()

    with patch("httpx.AsyncClient", DummyClient):
        response = client.get("/api/ai/models")

    assert response.status_code == 200
    body = response.json()
    assert body["reachable"] is False
    assert "non-JSON" in body["error"]


def test_session_persists_messages_and_context(tmp_path):
    client, _, user_data = _client(tmp_path)

    with patch("backend.services.assistant_service.httpx.AsyncClient", DummyAsyncClient):
        # First message
        response1 = client.post(
            "/api/ai/chat",
            json={"message": "First question"},
        )
        session_id = response1.json()["session_id"]

        # Second message in same session
        response2 = client.post(
            "/api/ai/chat",
            json={
                "message": "Follow-up question",
                "session_id": session_id,
            },
        )

    assert response2.status_code == 200
    body = response2.json()
    assert body["session_id"] == session_id

    # Load session from disk
    stored = read_json(user_data / "assistant" / "chat_sessions" / f"{session_id}.json")
    assert len(stored["messages"]) == 4  # 2 user + 2 assistant messages
    assert stored["messages"][0]["role"] == "user"
    assert stored["messages"][0]["content"] == "First question"
    assert stored["messages"][2]["role"] == "user"
    assert stored["messages"][2]["content"] == "Follow-up question"


def test_include_strategy_source_attaches_strategy_content(tmp_path):
    client, _, user_data = _client(tmp_path)

    # Create a strategy file
    strategies_dir = user_data / "strategies"
    strategy_file = strategies_dir / "TestStrategy.py"
    strategy_file.write_text("# Test strategy\ndef dummy(): pass", encoding="utf-8")

    with patch("backend.services.assistant_service.httpx.AsyncClient", DummyAsyncClient):
        response = client.post(
            "/api/ai/chat",
            json={
                "message": "Explain this strategy",
                "context_overrides": {"strategy_name": "TestStrategy"},
                "include_strategy_source": True,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"]


def test_empty_message_returns_422_error(tmp_path):
    client, _, _ = _client(tmp_path)

    response = client.post(
        "/api/ai/chat",
        json={"message": "   "},
    )

    assert response.status_code == 422


def test_load_nonexistent_session_returns_404(tmp_path):
    client, _, _ = _client(tmp_path)

    response = client.get("/api/ai/chat/nonexistent-session-id")

    assert response.status_code == 404
    assert "was not found" in response.json()["detail"]
