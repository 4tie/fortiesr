"""Comprehensive tests for the shared Ollama client compatibility layer."""

from __future__ import annotations

import asyncio
from pathlib import Path

import httpx
import pytest

from backend.services.ai.ollama_client import build_headers
from backend.services.ai.ollama_config import config_from_settings
from backend.services.auto_quant.ollama_service import (
    OllamaClient,
    create_ollama_client_from_settings,
)


@pytest.fixture
def temp_user_data_dir(tmp_path: Path) -> Path:
    """Create a temporary user data directory with settings."""
    user_data = tmp_path / "user_data"
    user_data.mkdir(parents=True, exist_ok=True)

    settings_file = user_data / "strategy_lab_settings.json"
    settings_file.write_text(
        """{
    "ollama_api_url": "http://localhost:11434",
    "ollama_model": "llama3",
    "ollama_provider": "local",
    "ollama_api_key": "",
    "ollama_timeout": 30
}""",
        encoding="utf-8",
    )

    return user_data


@pytest.fixture
def ollama_client():
    """Create an Ollama client instance for testing with fast retries."""
    return OllamaClient(
        base_url="http://localhost:11434",
        model="llama3",
        timeout=30,
        health_timeout=5,
        retry_delays=[0, 0],
    )


def _install_transport(client: OllamaClient, handler) -> None:
    client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_ollama_client_session_creation(ollama_client):
    """Test that Ollama client creates an httpx client correctly."""
    session = await ollama_client._get_client()
    assert session is not None
    assert not session.is_closed

    session2 = await ollama_client._get_client()
    assert session is session2

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_session_reuse_after_close(ollama_client):
    """Test that client creates a new httpx client after closing old one."""
    session1 = await ollama_client._get_client()
    session_id1 = id(session1)

    await ollama_client.close()

    session2 = await ollama_client._get_client()
    session_id2 = id(session2)

    assert session_id1 != session_id2, "Should create new session after close"

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_close_idempotent(ollama_client):
    """Test that closing client multiple times is safe."""
    await ollama_client._get_client()

    await ollama_client.close()
    await ollama_client.close()
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_health_check_success(ollama_client):
    """Test successful health check."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/tags"
        return httpx.Response(200, json={"models": [{"name": "llama3"}]}, request=request)

    _install_transport(ollama_client, handler)

    is_healthy = await ollama_client.check_health()
    assert is_healthy is True

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_health_check_timeout(ollama_client):
    """Test health check with timeout."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("timed out", request=request)

    _install_transport(ollama_client, handler)

    is_healthy = await ollama_client.check_health()
    assert is_healthy is False

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_health_check_client_error(ollama_client):
    """Test health check with client error."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection error", request=request)

    _install_transport(ollama_client, handler)

    is_healthy = await ollama_client.check_health()
    assert is_healthy is False

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_success(ollama_client):
    """Test successful AI generation."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/generate"
        return httpx.Response(200, json={"response": "Test response"}, request=request)

    _install_transport(ollama_client, handler)

    response = await ollama_client.generate("Test prompt", feature="test")
    assert response == "Test response"

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_invalid_prompt(ollama_client):
    """Test generate with invalid prompt."""
    response = await ollama_client.generate("", feature="test")
    assert response is None

    response = await ollama_client.generate(None, feature="test")  # type: ignore[arg-type]
    assert response is None

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_http_error(ollama_client):
    """Test generate with HTTP error."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error", request=request)

    _install_transport(ollama_client, handler)

    response = await ollama_client.generate("Test prompt", feature="test")
    assert response is None

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_json_parse_error(ollama_client):
    """Test generate with JSON parse error."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"not-json", request=request)

    _install_transport(ollama_client, handler)

    response = await ollama_client.generate("Test prompt", feature="test")
    assert response is None

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_empty_response(ollama_client):
    """Test generate with empty response."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": ""}, request=request)

    _install_transport(ollama_client, handler)

    response = await ollama_client.generate("Test prompt", feature="test")
    assert response is None

    await ollama_client.close()


def test_create_ollama_client_from_settings_success(temp_user_data_dir: Path):
    """Test successful client creation from settings."""
    client = create_ollama_client_from_settings(str(temp_user_data_dir))
    assert client is not None
    assert client.model == "llama3"
    assert client.base_url == "http://localhost:11434"


def test_create_ollama_client_from_settings_missing_file(tmp_path: Path):
    """Test client creation with missing settings file."""
    user_data = tmp_path / "nonexistent"
    client = create_ollama_client_from_settings(str(user_data))
    assert client is None


def test_create_ollama_client_from_settings_missing_model(temp_user_data_dir: Path):
    """Test client creation with missing model in settings."""
    settings_file = temp_user_data_dir / "strategy_lab_settings.json"
    settings_file.write_text(
        """{
    "ollama_api_url": "http://localhost:11434",
    "ollama_provider": "local"
}""",
        encoding="utf-8",
    )

    client = create_ollama_client_from_settings(str(temp_user_data_dir))
    assert client is None


@pytest.mark.asyncio
async def test_ollama_client_concurrent_generation(ollama_client):
    """Test concurrent generation requests."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": "Response"}, request=request)

    _install_transport(ollama_client, handler)

    tasks = [
        ollama_client.generate(f"Prompt {i}", feature=f"test{i}")
        for i in range(5)
    ]

    results = await asyncio.gather(*tasks)

    assert all(result == "Response" for result in results)

    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_retry_logic(ollama_client):
    """Test that retry logic is fast and returns None after transient failures."""
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        raise httpx.ConnectError("Connection failed", request=request)

    _install_transport(ollama_client, handler)

    response = await ollama_client.generate("Test prompt", feature="test_retry")
    assert response is None
    assert call_count == 3

    await ollama_client.close()


@pytest.mark.asyncio
async def test_cloud_api_key_headers_are_only_sent_for_cloud_provider():
    """Cloud provider sends Authorization; local provider ignores stored key."""
    cloud_config = config_from_settings(
        {
            "ollama_api_url": "https://ollama.com",
            "ollama_provider": "ollama_cloud",
            "ollama_api_key": "secret-token",
        },
        require_model=False,
    )
    local_config = config_from_settings(
        {
            "ollama_api_url": "http://localhost:11434",
            "ollama_provider": "local",
            "ollama_api_key": "secret-token",
        },
        require_model=False,
    )

    assert cloud_config is not None
    assert local_config is not None
    assert build_headers(cloud_config.base_url, api_key=cloud_config.auth_api_key)["Authorization"] == "Bearer secret-token"
    assert "Authorization" not in build_headers(local_config.base_url, api_key=local_config.auth_api_key)

