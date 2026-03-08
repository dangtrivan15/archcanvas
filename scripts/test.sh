#!/usr/bin/env bash
# test.sh - Exclusive test runner
#
# Ensures only one test suite runs at a time across all agents.
# Tests within a single run still execute concurrently (vitest maxForks: 3).
# Other agents wait up to 5 minutes for the lock before timing out.
#
# This prevents OOM kills when multiple agents run vitest simultaneously,
# each spawning multiple worker forks (3 agents × 3 forks = 9 parallel
# vitest workers consuming 1+ GB each).
#
# Usage:
#   ./scripts/test.sh                      # run all tests
#   ./scripts/test.sh --reporter=verbose   # pass args to vitest

set -euo pipefail

LOCKFILE="${TMPDIR:-/tmp}/archcanvas-test.lock"
TIMEOUT=300  # 5 minutes
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_DIR"

# Acquire exclusive lock (auto-released on exit/crash)
exec 200>"$LOCKFILE"
if ! flock -x -w "$TIMEOUT" 200; then
  echo "Error: Could not acquire test lock after ${TIMEOUT}s (another agent is running tests)" >&2
  exit 1
fi

echo "Test lock acquired, running vitest..."
npx vitest run "$@"
