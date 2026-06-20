#!/usr/bin/env bash
# start_backend.sh
# Entry point for the Strategy Lab backend.
# Runs Tailscale setup (skipped gracefully if TAILSCALE_AUTH_KEY is absent)
# then starts the FastAPI server.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[Backend] Running Tailscale setup..."
bash "$SCRIPT_DIR/setup_tailscale.sh" || {
    echo "[Backend] Tailscale setup encountered an error — continuing without it."
}

# Kill any lingering uvicorn process from a previous run, then let the
# OS reclaim the socket before we try to bind again.
pkill -f "uvicorn server" 2>/dev/null || true
sleep 1

# Only re-install dependencies when requirements.txt has changed.
HASH_FILE="/tmp/.requirements_hash"
CURRENT_HASH=$(md5sum "$SCRIPT_DIR/requirements.txt" 2>/dev/null | cut -d' ' -f1)
STORED_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")

if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
    echo "[Backend] Installing Python dependencies (requirements changed)..."
    pip install -r "$SCRIPT_DIR/requirements.txt" --quiet
    echo "$CURRENT_HASH" > "$HASH_FILE"
else
    echo "[Backend] Dependencies up-to-date (skipping install)."
fi

echo "[Backend] Starting FastAPI server..."
exec python -m uvicorn server:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir backend \
    --reload-include server.py
