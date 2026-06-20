#!/usr/bin/env bash
# setup_tailscale.sh
# Starts Tailscale in userspace-networking mode and authenticates using
# TAILSCALE_AUTH_KEY. Skips gracefully if the key is not set.

set -uo pipefail

SOCKET=/tmp/tailscale.sock

if [ -z "${TAILSCALE_AUTH_KEY:-}" ]; then
    echo "[Tailscale] TAILSCALE_AUTH_KEY is not set — skipping Tailscale setup."
    echo "[Tailscale] Add it to your Replit Secrets to enable Tailscale connectivity."
    exit 0
fi

# ── Install if missing ────────────────────────────────────────────────────────
if ! command -v tailscale &>/dev/null; then
    echo "[Tailscale] tailscale binary not found — installing via official script..."
    curl -fsSL https://tailscale.com/install.sh | sh
fi

# ── Start daemon if not already running ──────────────────────────────────────
if ! pgrep -x tailscaled >/dev/null 2>&1; then
    echo "[Tailscale] Starting tailscaled (userspace networking, in-memory state)..."
    tailscaled \
        --tun=userspace-networking \
        --state=mem: \
        --socket="$SOCKET" \
        >/tmp/tailscaled.log 2>&1 &
    # Wait for the socket to appear (up to 10 s)
    for i in $(seq 1 10); do
        [ -S "$SOCKET" ] && break
        sleep 1
    done
    if [ ! -S "$SOCKET" ]; then
        echo "[Tailscale] ERROR: daemon did not start in time. Check /tmp/tailscaled.log"
        exit 1
    fi
    echo "[Tailscale] Daemon started."
fi

# ── Authenticate ─────────────────────────────────────────────────────────────
echo "[Tailscale] Authenticating (hostname: strategy-lab)..."
tailscale \
    --socket="$SOCKET" \
    up \
    --authkey="$TAILSCALE_AUTH_KEY" \
    --hostname="strategy-lab" \
    --accept-routes \
    --reset

TS_IP=$(tailscale --socket="$SOCKET" ip -4 2>/dev/null || echo "unknown")
echo "[Tailscale] Connected.  Tailscale IPv4: $TS_IP"
echo "[Tailscale] You can now set Ollama URL to: http://${TS_IP}:11434 or your home machine's Tailscale IP."
