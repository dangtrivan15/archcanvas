#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REGISTRY="10.99.1.50:31000"

BUILD_LANDING=false

# If no arguments provided, build all
if [ $# -eq 0 ]; then
  BUILD_LANDING=true
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --archcanvas-landing)
      BUILD_LANDING=true
      shift
      ;;
    --help)
      echo "Usage: $0 [--archcanvas-landing]"
      echo ""
      echo "Build and push ArchCanvas images to the private registry."
      echo "  --archcanvas-landing   Build and push the landing page"
      echo "  (no args)             Build and push all"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

PIDS=()

if [ "$BUILD_LANDING" = true ]; then
  echo "Building and pushing archcanvas-landing..."
  (
    docker build --platform linux/amd64 -f "$REPO_ROOT/landing.Dockerfile" -t "$REGISTRY/archcanvas-landing:latest" "$REPO_ROOT" && \
    docker push "$REGISTRY/archcanvas-landing:latest"
  ) &
  PIDS+=($!)
fi

if [ ${#PIDS[@]} -gt 0 ]; then
  echo "Waiting for builds to complete..."
  FAILED=0
  for PID in "${PIDS[@]}"; do
    if ! wait "$PID"; then
      FAILED=1
    fi
  done

  if [ $FAILED -eq 1 ]; then
    echo "One or more builds failed. Exiting."
    exit 1
  fi
  echo "All builds completed successfully."
fi
