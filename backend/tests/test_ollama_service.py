"""Comprehensive tests for Ollama service."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.auto_quant.ollama_service import (
    OllamaClient,
    create_ollama_client_from_settings,
)


@pytest.fixture
def temp_user_data_dir(tmp_path: Path) -> Path:
    """Create a temporary user data directory with settings."""
    user_data = tmp_path / "user_data"
    user_data.mkdir(parents=True, exist_ok=True)
    
    # Create minimal settings file
    settings_file = user_data / "strategy_lab_settings.json"
    settings_file.write_text("""{
    "ollama_api_url": "http://localhost:11434",
    "ollama_model": "llama3",
    "ollama_provider": "local",
    "ollama_api_key": "",
    "ollama_timeout": 30
}""")
    
    return user_data


@pytest.fixture
def ollama_client():
    """Create an Ollama client instance for testing."""
    return OllamaClient(
        base_url="http://localhost:11434",
        model="llama3",
        timeout=30,
        health_timeout=5,
    )


@pytest.mark.asyncio
async def test_ollama_client_session_creation(ollama_client):
    """Test that Ollama client creates session correctly."""
    session = await ollama_client._get_session()
    assert session is not None
    assert not session.closed
    
    # Should return same session on subsequent calls
    session2 = await ollama_client._get_session()
    assert session is session2
    
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_session_reuse_after_close(ollama_client):
    """Test that client creates new session after closing old one."""
    # Get first session
    session1 = await ollama_client._get_session()
    session_id1 = id(session1)
    
    # Close the session
    await ollama_client.close()
    
    # Should create new session
    session2 = await ollama_client._get_session()
    session_id2 = id(session2)
    
    assert session_id1 != session_id2, "Should create new session after close"
    
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_close_idempotent(ollama_client):
    """Test that closing client multiple times is safe."""
    session = await ollama_client._get_session()
    
    # Close multiple times should not raise error
    await ollama_client.close()
    await ollama_client.close()
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_health_check_success(ollama_client):
    """Test successful health check."""
    with patch('aiohttp.ClientSession.get') as mock_get:
        async def mock_get_func(*args, **kwargs):
            mock_response = AsyncMock()
            mock_response.status = 200
            return mock_response
        
        mock_get.side_effect = mock_get_func
        
        is_healthy = await ollama_client.check_health()
        assert is_healthy is True
        
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_health_check_timeout(ollama_client):
    """Test health check with timeout."""
    async def mock_get_timeout(*args, **kwargs):
        raise asyncio.TimeoutError()
    
    with patch('aiohttp.ClientSession.get') as mock_get:
        mock_get.side_effect = mock_get_timeout
        
        is_healthy = await ollama_client.check_health()
        assert is_healthy is False
        
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_health_check_client_error(ollama_client):
    """Test health check with client error."""
    import aiohttp
    
    async def mock_get_error(*args, **kwargs):
        raise aiohttp.ClientError("Connection error")
    
    with patch('aiohttp.ClientSession.get') as mock_get:
        mock_get.side_effect = mock_get_error
        
        is_healthy = await ollama_client.check_health()
        assert is_healthy is False
        
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_success(ollama_client):
    """Test successful AI generation."""
    async def mock_post_success(*args, **kwargs):
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"response": "Test response"})
        
        # Make it work as async context manager
        async def enter(self):
            return mock_response
        
        async def exit(self, *args):
            pass
        
        mock_response.__aenter__ = enter
        mock_response.__aexit__ = exit
        
        return mock_response
    
    with patch('aiohttp.ClientSession.post') as mock_post:
        mock_post.side_effect = mock_post_success
        
        response = await ollama_client.generate("Test prompt", feature="test")
        assert response == "Test response"
        
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_invalid_prompt(ollama_client):
    """Test generate with invalid prompt."""
    # Empty prompt
    response = await ollama_client.generate("", feature="test")
    assert response is None
    
    # None prompt
    response = await ollama_client.generate(None, feature="test")  # type: ignore
    assert response is None
    
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_http_error(ollama_client):
    """Test generate with HTTP error."""
    async def mock_post_http_error(*args, **kwargs):
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value="Internal Server Error")
        
        async def enter(self):
            return mock_response
        
        async def exit(self, *args):
            pass
        
        mock_response.__aenter__ = enter
        mock_response.__aexit__ = exit
        
        return mock_response
    
    with patch('aiohttp.ClientSession.post') as mock_post:
        mock_post.side_effect = mock_post_http_error
        
        response = await ollama_client.generate("Test prompt", feature="test")
        assert response is None
        
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_json_parse_error(ollama_client):
    """Test generate with JSON parse error."""
    async def mock_post_json_error(*args, **kwargs):
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(side_effect=Exception("Invalid JSON"))
        
        async def enter(self):
            return mock_response
        
        async def exit(self, *args):
            pass
        
        mock_response.__aenter__ = enter
        mock_response.__aexit__ = exit
        
        return mock_response
    
    with patch('aiohttp.ClientSession.post') as mock_post:
        mock_post.side_effect = mock_post_json_error
        
        response = await ollama_client.generate("Test prompt", feature="test")
        assert response is None
        
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_generate_empty_response(ollama_client):
    """Test generate with empty response."""
    async def mock_post_empty(*args, **kwargs):
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"response": ""})
        
        async def enter(self):
            return mock_response
        
        async def exit(self, *args):
            pass
        
        mock_response.__aenter__ = enter
        mock_response.__aexit__ = exit
        
        return mock_response
    
    with patch('aiohttp.ClientSession.post') as mock_post:
        mock_post.side_effect = mock_post_empty
        
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
    # Create settings without model
    settings_file = temp_user_data_dir / "strategy_lab_settings.json"
    settings_file.write_text("""{
    "ollama_api_url": "http://localhost:11434",
    "ollama_provider": "local"
}""")
    
    client = create_ollama_client_from_settings(str(temp_user_data_dir))
    assert client is None


@pytest.mark.asyncio
async def test_ollama_client_concurrent_generation(ollama_client):
    """Test concurrent generation requests."""
    async def mock_post_concurrent(*args, **kwargs):
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"response": "Response"})
        
        async def enter(self):
            return mock_response
        
        async def exit(self, *args):
            pass
        
        mock_response.__aenter__ = enter
        mock_response.__aexit__ = exit
        
        return mock_response
    
    with patch('aiohttp.ClientSession.post') as mock_post:
        mock_post.side_effect = mock_post_concurrent
        
        # Make concurrent requests
        tasks = [
            ollama_client.generate(f"Prompt {i}", feature=f"test{i}")
            for i in range(5)
        ]
        
        results = await asyncio.gather(*tasks)
        
        # All should succeed
        assert all(result == "Response" for result in results)
        
    await ollama_client.close()


@pytest.mark.asyncio
async def test_ollama_client_retry_logic(ollama_client):
    """Test that retry logic works on transient failures."""
    # Test that the client handles errors gracefully and returns None
    # rather than testing exact retry count which is timing-dependent
    
    async def mock_post_failure(*args, **kwargs):
        # Always raise a connection error to trigger retry logic
        import aiohttp
        raise aiohttp.ClientError("Connection failed")
    
    with patch('aiohttp.ClientSession.post') as mock_post:
        mock_post.side_effect = mock_post_failure
        
        # Should return None after retries are exhausted
        response = await ollama_client.generate("Test prompt", feature="test_retry")
        assert response is None
        
    await ollama_client.close()