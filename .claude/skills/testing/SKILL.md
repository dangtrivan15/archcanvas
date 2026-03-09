---
name: testing
description: Use when writing, running, or debugging unit/integration/e2e tests for ArchCanvas. Covers test conventions, directory structure, running tests safely in multi-agent environments, and patterns for testing pure functions, Zustand stores, React components, and Playwright e2e.
---

# ArchCanvas Testing Guide

## Running Tests

### Unit & Integration Tests (Vitest)

**ALWAYS use the mutex-locked test runner.** It is non-blocking — it returns
immediately and you poll for results.

**NEVER run `npm test` or `npx vitest run` directly** — they bypass the mutex
and will cause OOM when multiple agents run tests simultaneously (vitest spawns
3 worker forks internally).

#### Step 1: Start tests

```bash
./scripts/test.sh                        # run all tests
./scripts/test.sh --reporter=verbose     # with vitest args
./scripts/test.sh test/unit/core/        # run subset by path
./scripts/test.sh -t "addNode"           # run by test name pattern
```

The script prints one of two responses:

**Lock acquired — tests started:**
```
STATUS=STARTED
KEY=12345-1709913600
PID=12346
Tests started in background. Poll with: ./scripts/test.sh --poll 12345-1709913600
```

Save the `KEY` value. You need it to retrieve results.

**Lock held by another agent:**
```
STATUS=BUSY
Another test is running. Retry after 1 minute.
```

Wait ~1 minute, then call the same command again.

#### Step 2: Poll for results

```bash
./scripts/test.sh --poll <KEY>
```

Three possible responses:

**Tests still running:**
```
STATUS=RUNNING
Tests are still running (PID 12346). Retry after 1 minute.
```

Wait ~1 minute, then poll again.

**Tests done:**
```
STATUS=DONE
EXIT_CODE=0
ARGS=--reporter=verbose
STARTED_AT=2026-03-09T14:30:00Z
LOG_FILE=tmp/test/12345-1709913600/output.log
RESULT_DIR=tmp/test/12345-1709913600
```

The script exits with vitest's exit code (`$?`), so you can branch on pass/fail.
**Use the Read tool on `LOG_FILE` to get the full test output** — this avoids
truncation from large logs. Results persist in the project's `tmp/test/` directory
until you run `--kill KEY` or delete the directory manually.

**Invalid or expired key:**
```
STATUS=INVALID_KEY
```

This means either the key is wrong, or another agent reclaimed the lock after
the previous test session's process died. Start a new test run.

#### Complete example workflow

```bash
# 1. Start tests
OUTPUT=$(./scripts/test.sh --reporter=verbose)
KEY=$(echo "$OUTPUT" | grep '^KEY=' | cut -d= -f2)

if echo "$OUTPUT" | grep -q '^STATUS=BUSY'; then
  echo "Tests already running, retry later"
  exit 0
fi

# 2. Poll until done (in practice, agents retry across separate invocations)
while true; do
  sleep 60
  RESULT=$(./scripts/test.sh --poll "$KEY")
  if echo "$RESULT" | grep -q '^STATUS=DONE'; then
    echo "$RESULT"
    break
  fi
  if echo "$RESULT" | grep -q '^STATUS=INVALID_KEY'; then
    echo "Session expired, start a new run"
    break
  fi
  # STATUS=RUNNING — keep polling
done
```

#### Kill a running test

If you need to cancel a running test (e.g., wrong args, taking too long):

```bash
./scripts/test.sh --kill <KEY>
```

Two possible responses:

**Test was running — killed:**
```
STATUS=KILLED
PID=12346
```

**Test had already finished:**
```
STATUS=ALREADY_STOPPED
PID=12346
```

Both cases clean up the results directory and release the lock. After killing,
you can start a new test run immediately.

#### Concurrency configuration

The script limits concurrent vitest processes via `scripts/.test.env`:

```env
# Max concurrent vitest processes (each spawns 3 forks ~1GB each)
SLOTS=1
```

Default is `SLOTS=1` (one test at a time). Set `SLOTS=2` to allow two concurrent
test runs, etc. Env var `SLOTS` overrides the file (e.g., `SLOTS=2 ./scripts/test.sh`).

#### Important rules

**DO NOT delete, remove, or work around the lock directories.** The lock slots at
`${TMPDIR}/archcanvas-test.lock.{0..N}` exist to protect all agents from OOM kills.
Deleting them while tests are running will cause concurrent vitest processes and
crash the system. The script handles stale locks automatically (detects dead PIDs
and cleans up). If you think a lock is stuck, use `--kill KEY` or inspect with
`ps` first.

**DO NOT lose your key.** If you start tests but never poll, the slot persists
until another agent detects the dead process and reclaims it via stale detection.
Always poll for results after starting tests.

### E2E Tests (Playwright)

```bash
# Ensure dev server is running first (idempotent, safe to call multiple times)
npm run dev:ensure

# Run e2e tests
npx playwright test

# Run specific test
npx playwright test test/e2e/feature-371-drag-drop.spec.ts

# Do NOT stop the dev server when done — other agents may be using it
```

### Quick Verification After Changes

```bash
# Type check first (synchronous), then start tests (non-blocking)
npx tsc --noEmit && ./scripts/test.sh

# Full verification including build
npm run build && ./scripts/test.sh
```

Note: `./scripts/test.sh` returns immediately. Remember to poll with the
returned key to get actual test results.

## Directory Structure

```
test/
  setup.ts                          # Imports @testing-library/jest-dom
  unit/
    api/                            # TextApi, RenderApi, ExportApi tests
      textApiAddNode.test.ts
      renderApiPorts.test.ts
      exportApiMermaid.test.ts
    core/                           # Graph engine, codec, storage, registry, undo
      graphEngine.test.ts
      codec.test.ts
      undoManager.test.ts
    components/                     # React component tests (.test.tsx)
      NodeShell.test.tsx
    cli/                            # CLI command tests
      initCommand.test.ts
    hooks/                          # React hook tests
      useAppUrlOpen.test.ts
    analyze/                        # Analysis pipeline tests
      detector.test.ts
  integration/
    cli/                            # CLI round-trip tests
      cliRoundTrip.test.ts
    http/                           # HTTP server tests
      httpServer.test.ts
  e2e/                              # Playwright browser tests
    feature-371-drag-drop.spec.ts
```

### File Naming Convention

- Unit/integration: `<descriptiveName>.test.ts` or `.test.tsx` for component tests
- E2E: `<feature-description>.spec.ts`
- Place tests in the subdirectory matching the source module being tested:
  - Testing `src/api/textApi.ts` → `test/unit/api/textApi*.test.ts`
  - Testing `src/core/graph/graphEngine.ts` → `test/unit/core/graphEngine.test.ts`
  - Testing `src/components/nodes/NodeShell.tsx` → `test/unit/components/NodeShell.test.tsx`

### Test Header Convention

Each test file starts with a JSDoc comment describing what it tests:

```typescript
/**
 * Unit tests for the graph engine CRUD operations.
 * Covers: addChildNode, findNode (recursive), removeNode with cascading edges.
 */
```

For feature-linked tests, reference the feature number:

```typescript
/**
 * Feature #43: Text API addNode() creates node in graph
 */
```

## Test Environment

| File pattern | Environment | Use for |
|-------------|-------------|---------|
| `*.test.ts` | `node` | Pure logic: graph engine, codecs, APIs, CLI |
| `*.test.tsx` | `happy-dom` | React components with DOM rendering |
| `*.spec.ts` | Playwright (Chromium) | Full browser e2e tests |

This is configured in `vitest.config.ts` via `environmentMatchGlobs`.
Do NOT change `environment: 'node'` to `'jsdom'` globally — the node environment
is intentionally used for the majority of tests (faster, no DOM overhead).

## Writing Tests — Patterns

### Pure Function Tests (most common)

The graph engine and APIs are pure functions — no mocks needed:

```typescript
import { describe, it, expect } from 'vitest';
import { createEmptyGraph, createNode, addNode, findNode } from '@/core/graph/graphEngine';

describe('addNode', () => {
  it('should add a node to the graph', () => {
    let graph = createEmptyGraph('Test');
    const node = createNode({ type: 'compute/service', displayName: 'My Service' });
    graph = addNode(graph, node);

    expect(findNode(graph, node.id)).toBeDefined();
    expect(graph.nodes).toHaveLength(1);
  });
});
```

### API Tests (TextApi, RenderApi, ExportApi)

APIs need a RegistryManager initialized with node definitions:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('TextApi.someMethod', () => {
  let registry: RegistryManager;

  beforeEach(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  function createEmptyGraph(): ArchGraph {
    return { name: 'Test', description: '', owners: [], nodes: [], edges: [] };
  }

  it('should do something', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);
    // textApi methods mutate internal state and return results
    const node = textApi.addNode({ type: 'data/database', displayName: 'DB' });
    expect(node).toBeDefined();
  });
});
```

### React Component Tests

Use React Testing Library with happy-dom (automatic for `.test.tsx` files):

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### What NOT to Test

- Don't write tests for simple pass-through functions or trivial getters
- Don't test React Flow internals or third-party library behavior
- Don't write e2e tests for things that can be unit tested
- Don't mock what you can construct (prefer real RegistryManager over mocked one)

## Debugging Failing Tests

```bash
# Start a single test file with verbose output
./scripts/test.sh test/unit/core/graphEngine.test.ts --reporter=verbose
# → save the KEY, then poll:
./scripts/test.sh --poll <KEY>
# → STATUS=DONE output includes full vitest log between ---LOG--- and ---END---

# For Playwright, generate trace on failure
npx playwright test --trace on
```
