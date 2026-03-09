#!/usr/bin/env bash
# test.sh - Non-blocking exclusive test runner
#
# Limits concurrent vitest processes to prevent OOM kills.
# Each vitest spawns 3 worker forks (~1GB each).
#
# Usage:
#   ./scripts/test.sh [vitest args...]    Start tests, returns a poll key
#   ./scripts/test.sh --poll KEY          Poll for results using the key
#   ./scripts/test.sh --kill KEY          Kill a running test by key
#
# Configure max concurrent runs in scripts/.test.env (default: SLOTS=1).
# Results are stored separately from locks so they survive lock reclamation.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_BASE="${TMPDIR:-/tmp}/archcanvas-test.lock"
RESULTS_BASE="${PROJECT_DIR}/tmp/test"
ENV_FILE="${PROJECT_DIR}/scripts/.test.env"

cd "$PROJECT_DIR"

# --- Load config ---

MAX_SLOTS=1
if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r key value; do
    # Skip comments and blank lines
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    case "$key" in
      SLOTS) MAX_SLOTS="$value" ;;
    esac
  done < "$ENV_FILE"
fi
# Env var overrides file
MAX_SLOTS="${SLOTS:-$MAX_SLOTS}"

# --- Helpers ---

# Validate a key and set RESULT_DIR. Exits with INVALID_KEY if bad.
require_key() {
  local key="$1"
  RESULT_DIR="${RESULTS_BASE}/${key}"
  if [[ ! -d "$RESULT_DIR" ]]; then
    echo "STATUS=INVALID_KEY"
    exit 1
  fi
}

# Read a file or return a default. Usage: read_or DEFAULT FILE
read_or() {
  cat "$2" 2>/dev/null || echo "$1"
}

# Read the vitest PID from current RESULT_DIR.
read_pid() {
  read_or "" "$RESULT_DIR/pid"
}

# --- Poll mode ---

poll_results() {
  require_key "$1"
  local vitest_pid
  vitest_pid=$(read_pid)

  if [[ -n "$vitest_pid" ]] && kill -0 "$vitest_pid" 2>/dev/null; then
    echo "STATUS=RUNNING"
    echo "Tests are still running (PID $vitest_pid). Retry after 1 minute."
    exit 0
  fi

  # Process is done — collect results
  local exit_code
  exit_code=$(read_or 1 "$RESULT_DIR/exit_code")

  echo "STATUS=DONE"
  echo "EXIT_CODE=$exit_code"
  echo "ARGS=$(read_or "(none)" "$RESULT_DIR/args")"
  echo "STARTED_AT=$(read_or unknown "$RESULT_DIR/started_at")"
  echo "LOG_FILE=$RESULT_DIR/output.log"
  echo "RESULT_DIR=$RESULT_DIR"

  exit "$exit_code"
}

# --- Kill mode ---

kill_tests() {
  require_key "$1"
  local vitest_pid
  vitest_pid=$(read_pid)

  # Kill the process if still running
  if [[ -n "$vitest_pid" ]] && kill -0 "$vitest_pid" 2>/dev/null; then
    kill "$vitest_pid" 2>/dev/null || true
    echo "STATUS=KILLED"
    echo "PID=$vitest_pid"
  else
    echo "STATUS=ALREADY_STOPPED"
    echo "PID=${vitest_pid:-(unknown)}"
  fi

  # Find and release the lock slot that holds this PID
  local slot_dir
  for i in $(seq 0 $((MAX_SLOTS - 1))); do
    slot_dir="${LOCK_BASE}.${i}"
    if [[ -f "$slot_dir/pid" ]]; then
      local slot_pid
      slot_pid=$(cat "$slot_dir/pid" 2>/dev/null || echo "")
      if [[ "$slot_pid" == "$vitest_pid" ]]; then
        rm -rf "$slot_dir" 2>/dev/null
        break
      fi
    fi
  done

  rm -rf "$RESULT_DIR" 2>/dev/null
}

# --- Route subcommands ---

case "${1:-}" in
  --poll)
    [[ -z "${2:-}" ]] && { echo "Usage: $0 --poll KEY" >&2; exit 1; }
    poll_results "$2"
    ;;
  --kill)
    [[ -z "${2:-}" ]] && { echo "Usage: $0 --kill KEY" >&2; exit 1; }
    kill_tests "$2"
    exit 0
    ;;
esac

# --- Start mode ---

# Try to acquire any free slot. Sets SLOT_DIR on success.
try_acquire_slot() {
  local slot_dir
  for i in $(seq 0 $((MAX_SLOTS - 1))); do
    slot_dir="${LOCK_BASE}.${i}"

    if mkdir "$slot_dir" 2>/dev/null; then
      SLOT_DIR="$slot_dir"
      return 0
    fi

    # Check for stale lock (owner process died)
    if [[ -f "$slot_dir/pid" ]]; then
      local owner_pid
      owner_pid=$(cat "$slot_dir/pid" 2>/dev/null || echo "")
      if [[ -n "$owner_pid" ]] && ! kill -0 "$owner_pid" 2>/dev/null; then
        rm -rf "$slot_dir" 2>/dev/null
        if mkdir "$slot_dir" 2>/dev/null; then
          SLOT_DIR="$slot_dir"
          return 0
        fi
      fi
    fi
  done

  return 1
}

if ! try_acquire_slot; then
  echo "STATUS=BUSY"
  echo "All $MAX_SLOTS test slot(s) occupied. Retry after 1 minute."
  exit 0
fi

# Slot acquired — generate key and set up results directory
KEY="$$-$(date +%s)"
RESULT_DIR="${RESULTS_BASE}/${KEY}"
mkdir -p "$RESULT_DIR"

echo "$*" > "$RESULT_DIR/args"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$RESULT_DIR/started_at"

# Start vitest in a background subshell.
# `|| vitest_ec=$?` prevents inherited `set -e` from killing the subshell on test failures.
(
  vitest_ec=0
  npx vitest run "$@" > "$RESULT_DIR/output.log" 2>&1 || vitest_ec=$?
  echo "$vitest_ec" > "$RESULT_DIR/exit_code"
  rm -rf "$SLOT_DIR" 2>/dev/null
) &
VITEST_PID=$!
disown

echo "$VITEST_PID" > "${SLOT_DIR}/pid.tmp" && mv "${SLOT_DIR}/pid.tmp" "${SLOT_DIR}/pid"
echo "$VITEST_PID" > "$RESULT_DIR/pid"

echo "STATUS=STARTED"
echo "KEY=$KEY"
echo "PID=$VITEST_PID"
echo "SLOT=$SLOT_DIR"
echo "Tests started in background. Poll with: $0 --poll $KEY"
