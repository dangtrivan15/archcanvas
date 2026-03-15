# Task 7: E2E Test Coverage for UI Polish Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Add E2E regression tests for UI polish bug fixes from progress 06
**Parent feature:** [Phase 13 Index](./2026-03-15-refactor-cleanup-index.md)

## Write Set

- Create: `test/e2e/ui-polish.spec.ts` (test, unlimited)
- Modify: `test/e2e/e2e-helpers.ts` (~+10 lines — any shared helpers needed)

## Read Set (context needed)

- `docs/plans/2026-03-13-ui-bugs-and-polish.md` — Task 14, all test scenarios
- `docs/progress/06-ui-bugs-and-polish.md` — which fixes were applied
- `test/e2e/canvas-operations.spec.ts` — existing E2E patterns to follow
- `test/e2e/app-shell.spec.ts` — existing E2E patterns
- `test/e2e/e2e-helpers.ts` — shared helpers (`gotoApp`, `resetToEmptyProject`)
- `src/components/canvas/Canvas.tsx` — canvas component for selector reference
- `src/components/shared/ContextMenu.tsx` — context menu selectors
- `src/components/nodes/NodeRenderer.tsx` — node rendering (for icon/shape tests)

## Dependencies

- **Blocked by:** Task 4 (tests should cover the U4 fix)
- **Blocks:** Nothing

## Description

Progress doc 06 listed "Task 14: Comprehensive E2E tests for all fixed flows" as unstarted. These bug fixes are verified manually but lack regression protection. This task adds that E2E coverage.

### Test scenarios

Based on the bugs fixed in progress 06, write E2E tests for:

**B1 — Context menu delete works on correct node:**
1. Add 2 nodes → right-click the second → click "Delete" → verify only the second is removed
2. Verify the first node is still present and unaffected

**B3 — Toolbar tool modes:**
1. Click "Pan" toolbar button → verify cursor changes / drag behavior changes
2. Click "Select" toolbar button → verify back to selection mode
3. Verify toolbar buttons have correct `data-active` attribute

**B4 — Node icons render correctly:**
1. Add a Service node → verify the Server icon renders (not the text "Server")
2. Add a Database node → verify the Database icon renders

**B5 — Status bar grammar:**
1. Add 1 node → verify status bar shows "1 node" (singular)
2. Add 2 nodes → verify status bar shows "2 nodes" (plural)

**U1 — Right-click selects node:**
1. Right-click a node → verify it becomes selected (detail panel opens or selection state updates)

**U4 — Menu click does not deselect node (from Task 4 fix):**
1. Right-click a node → click "Edit Properties" → verify node is still selected and panel opens
2. Right-click a node → press Escape (close menu) → verify node is still selected

**U5 — New nodes named by displayName:**
1. Add a Service node → verify its label shows "Service" (not "compute/service")
2. Add a second Service node → verify deduplication ("Service 2" or similar)

### Implementation approach

Follow the existing E2E test patterns in `canvas-operations.spec.ts`:
- Use `gotoApp(page)` to set up
- Use `page.keyboard.press('Meta+k')` to open command palette
- Use `page.locator('.react-flow__node')` to find nodes
- Use `page.locator('[data-active="true"]')` for toolbar button state
- Use `page.getByText(...)` for status bar assertions

### Note on test stability

- Add `await page.waitForTimeout(200)` between rapid state changes (command palette → node creation)
- Use `toBeVisible()` with Playwright auto-wait rather than explicit waits where possible
- Context menu tests need `page.click({ button: 'right' })` on specific node elements

### Acceptance criteria

- [ ] `test/e2e/ui-polish.spec.ts` exists with all test scenarios above
- [ ] All new E2E tests pass on `vite preview` (production build)
- [ ] Existing E2E tests still pass (no regressions)
- [ ] Tests cover at minimum: B1, B3, B4, B5, U1, U4, U5
