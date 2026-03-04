#!/usr/bin/env bash
# ensure-dev-server.sh - Idempotent Vite dev server launcher
#
# Ensures exactly one Vite dev server is running on port 5173.
# If already running, exits 0 silently. If not, starts one in the background
# and waits until the port is ready.
#
# Used by both humans and coding agents. Combined with strictPort: true
# in vite.config.ts, this guarantees at most one dev server process.
#
# Usage:
#   ./scripts/ensure-dev-server.sh          # start/verify server
#   ./scripts/ensure-dev-server.sh --stop   # stop the server
#
# Target: macOS / Linux

set -euo pipefail

PORT=5173
MAX_POLLS=60       # max number of health check attempts (60 * 0.5s = 30s)
LOG_FILE="${TMPDIR:-/tmp}/archcanvas-dev-server.log"
PID_FILE="${TMPDIR:-/tmp}/archcanvas-dev-server.pid"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- Helpers ---

is_port_responding() {
  curl -sf -o /dev/null -w '' "http://localhost:${PORT}" 2>/dev/null
}

find_vite_pid() {
  # Try PID file first, then fall back to lsof
  if [[ -f "$PID_FILE" ]]; then
    local PID
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
      echo "$PID"
      return
    fi
  fi
  # Fallback: find process listening on the port via lsof
  lsof -ti "tcp:${PORT}" 2>/dev/null | head -1 || true
}

# --- Stop command ---

if [[ "${1:-}" == "--stop" ]]; then
  PID=$(find_vite_pid)
  if [[ -n "$PID" ]]; then
    kill "$PID" 2>/dev/null || true
    # Wait for port to free up
    for _ in $(seq 1 10); do
      if ! is_port_responding; then
        break
      fi
      sleep 0.5
    done
    echo "Dev server stopped (PID $PID)"
  else
    echo "No dev server running on port $PORT"
  fi
  rm -f "$PID_FILE"
  exit 0
fi

# --- Idempotent start ---

# Check if server is already responding
if is_port_responding; then
  # Server is already running - nothing to do
  exit 0
fi

# Acquire a lock to prevent concurrent launches
LOCK_FILE="${TMPDIR:-/tmp}/archcanvas-dev-server.lock"

# Use mkdir as an atomic lock (works on macOS and Linux)
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  # Another process is starting the server - wait for it
  for _ in $(seq 1 "$MAX_POLLS"); do
    if is_port_responding; then
      exit 0
    fi
    sleep 0.5
  done
  echo "Error: Timed out waiting for dev server (concurrent launch)" >&2
  exit 1
fi

# Ensure lock is cleaned up on exit
cleanup_lock() {
  rm -rf "$LOCK_FILE" 2>/dev/null || true
}
trap cleanup_lock EXIT

# Double-check after acquiring lock (another process may have started it)
if is_port_responding; then
  exit 0
fi

# Start Vite dev server in the background
cd "$PROJECT_DIR"
nohup npm run dev > "$LOG_FILE" 2>&1 &
DEV_PID=$!
echo "$DEV_PID" > "$PID_FILE"

# Wait for the server to become ready
for _ in $(seq 1 "$MAX_POLLS"); do
  if is_port_responding; then
    exit 0
  fi

  # Check if the process is still alive
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "Error: Dev server process exited unexpectedly. Check $LOG_FILE" >&2
    exit 1
  fi

  sleep 0.5
done

echo "Error: Dev server did not become ready within 30s. Check $LOG_FILE" >&2
exit 1
