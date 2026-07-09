"""Config for AeRo — thin wrapper around FortiesR paths and settings."""

from __future__ import annotations

import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

# FortiesR backend API
FORTIESR_API_URL = os.getenv("FORTIESR_API_URL", "http://localhost:8000")

# Local AeRo storage
AERO_UPLOADS_DIR = ROOT_DIR / "aero" / "uploads"
AERO_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Ollama (optional)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
