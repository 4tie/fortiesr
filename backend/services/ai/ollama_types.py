"""Shared Ollama transport types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class OllamaConfig:
    """Resolved Ollama connection settings."""

    base_url: str
    model: str
    provider: str = "local"
    api_key: str | None = None
    timeout: float = 30.0
    health_timeout: float = 5.0
    strict_json: bool = False
    log_dir: str | None = None

    @property
    def auth_api_key(self) -> str | None:
        return self.api_key if self.provider == "ollama_cloud" else None

    @property
    def cache_key(self) -> tuple[Any, ...]:
        return (
            self.base_url.rstrip("/"),
            self.model,
            self.provider,
            bool(self.auth_api_key),
            self.timeout,
            self.health_timeout,
            self.strict_json,
            self.log_dir,
        )


@dataclass
class OllamaChatResponse:
    """Normalized response from Ollama /api/chat."""

    content: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    raw: dict[str, Any] | None = None

