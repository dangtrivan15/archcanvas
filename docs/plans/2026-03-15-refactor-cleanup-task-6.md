# Task 6: Split bridge.test.ts + SDK Regression Tests

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Split 1227-line bridge test file by concern + add regression tests for SDK type fixes
**Parent feature:** [Phase 13 Index](./2026-03-15-refactor-cleanup-index.md)

## Write Set

- Create: `test/ai/bridge-test-helpers.ts` — shared `setupSession`, `collect()`, SDK message factories (~100 lines)
- Modify: `test/ai/bridge.test.ts` — keep only connection/session tests, import from helpers (~400 lines)
- Create: `test/ai/bridge-stream.test.ts` — stream translation tests + SDK regression tests (~400 lines)
- Create: `test/ai/bridge-dispatcher.test.ts` — store action dispatcher tests (~350 lines)
- Create: `test/ai/bridge-permissions.test.ts` — permission + question + interrupt tests (~200 lines)

## Read Set (context needed)

- `test/ai/bridge.test.ts` — full 1227-line file (understand describe blocks to split)
- `src/core/ai/claudeCodeBridge.ts` — bridge implementation (understand what each test section covers)
- `src/core/ai/types.ts` — `ChatEvent` union, `SDKMessage` references

## Dependencies

- **Blocked by:** Task 5 (the rename may touch type imports in bridge tests)
- **Blocks:** Nothing

## Description

### Part 1: Split bridge.test.ts

The bridge test file is 1227 lines and growing. Progress doc 10 flagged this for splitting by concern. The current describe blocks map naturally to 4 files:

**1. `bridge.test.ts` (keep — connection/session lifecycle)**
- `setupSession` helper and shared imports
- `describe('createBridgeSession')` — session creation, options, cwd
- `describe('session lifecycle')` — connect, disconnect, reconnect
- `describe('query interaction')` — basic query flow

**2. `bridge-stream.test.ts` (new — stream translation)**
- `describe('stream translation')` — SDK messages → ChatEvents
- All `case` handlers: `assistant`, `tool_use`, `tool_result`, `result`, `rate_limit_event`, `stream_event`, `tool_progress`
- Text delta accumulation tests

**3. `bridge-dispatcher.test.ts` (new — store action dispatching)**
- `describe('store_action dispatching')` or equivalent
- `dispatchAddNode`, `dispatchImport`, `dispatchList`, `dispatchDescribe`, `dispatchSearch`, `dispatchCatalog`
- Read and write dispatcher tests

**4. `bridge-permissions.test.ts` (new — permissions/questions/interrupt)**
- `describe('permission handling')` — canUseTool callbacks, SDK permission flow
- `describe('question handling')` — AskUserQuestion flow
- `describe('interrupt')` — interrupt flow, pending permission resolution

### Part 2: SDK Regression Tests

Progress doc 12 noted two bugs found by the SDK type audit that were fixed but lack regression tests:

**1. Dead `case 'status'` handler** — The SDK has no `type: 'status'` message. Status was working via `tool_progress`. The dead handler was removed. Add a test that verifies unknown/unexpected message types are ignored (not translated to events).

**2. Wrong `case 'rate_limit'` type name** — The SDK uses `'rate_limit_event'` (not `'rate_limit'`), with structured `rate_limit_info` (not a simple `message` string). Add a test that verifies:
- `rate_limit_event` with `status: 'rejected'` → emits `rate_limit` ChatEvent with "Rate limit reached. Waiting..."
- `rate_limit_event` with `status: 'allowed_warning'` → emits `rate_limit` ChatEvent with "Approaching rate limit"
- `rate_limit_event` with `status: 'allowed'` → no event emitted (below threshold)

These tests go into the new `bridge-stream.test.ts`.

### Shared test infrastructure

The `setupSession` helper, `collect()` function, and SDK message factories (`sdkSystemInit`, `sdkAssistantText`, etc.) are used by all 4 test files. Extract them to `test/ai/bridge-test-helpers.ts` (included in write set above). All split test files import from this helper module.

### Implementation approach

1. Read `bridge.test.ts` and identify the exact describe blocks and their line ranges
2. Create the 3 new files, moving the appropriate describe blocks
3. Extract shared helpers to either the main file or a helper file
4. Add the 2 SDK regression tests to `bridge-stream.test.ts`
5. Run all tests to verify nothing broke in the split

### Acceptance criteria

- [ ] `bridge.test.ts` is ≤500 lines (down from 1227)
- [ ] 3 new test files exist: `bridge-stream.test.ts`, `bridge-dispatcher.test.ts`, `bridge-permissions.test.ts`
- [ ] All existing bridge tests pass (same test count, just reorganized)
- [ ] New regression test: unknown SDK message types are silently ignored
- [ ] New regression test: `rate_limit_event` with `rejected` → correct ChatEvent
- [ ] New regression test: `rate_limit_event` with `allowed_warning` → correct ChatEvent
- [ ] New regression test: `rate_limit_event` with `allowed` → no ChatEvent
- [ ] Total test count increases by ≥4 (the new regression tests)
