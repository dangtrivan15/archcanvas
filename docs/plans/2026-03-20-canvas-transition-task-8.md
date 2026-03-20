# Task 8: E2E Tests + Verification

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add E2E tests for canvas transitions and verify all existing tests pass.

**Files:**
- Create: `test/e2e/canvas-transition.spec.ts`
- Verify: all existing E2E specs still pass

**Depends on:** Task 7 (animation complete)

**Spec reference:** Testing Strategy section.

---

### Step 1: Create E2E spec file

- [ ] Create `test/e2e/canvas-transition.spec.ts` using patterns from `test/e2e/subsystem.spec.ts` and `test/e2e/e2e-helpers.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { gotoApp, createSubsystem, diveIntoSubsystem } from './e2e-helpers';

test.describe('Canvas Transition Animation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    // Create a subsystem to navigate into
    await createSubsystem(page, 'auth-service', /service/i);
  });

  test('dive-in: double-click RefNode navigates to child canvas', async ({ page }) => {
    // Double-click the auth-service RefNode
    const refNode = page.locator('[data-testid="main-canvas"] .react-flow__node').filter({ hasText: 'auth-service' });
    await refNode.dblclick();

    // Breadcrumb should show Root > auth-service
    await expect(page.locator('.breadcrumb')).toContainText('auth-service');

    // Canvas should show the child canvas content (empty initially)
    // The main-canvas testid should still be present
    await expect(page.locator('[data-testid="main-canvas"]')).toBeVisible();
  });

  test('go-up: Escape returns to parent canvas', async ({ page }) => {
    await diveIntoSubsystem(page, 'auth-service');
    await expect(page.locator('.breadcrumb')).toContainText('auth-service');

    await page.keyboard.press('Escape');

    // Breadcrumb should show Root only
    await expect(page.locator('.breadcrumb')).not.toContainText('auth-service');

    // The RefNode should be visible again
    const refNode = page.locator('[data-testid="main-canvas"] .react-flow__node').filter({ hasText: 'auth-service' });
    await expect(refNode).toBeVisible();
  });

  test('rendering consistency: RefNode preview matches child canvas', async ({ page }) => {
    // Add a node inside the subsystem via dive-in
    await diveIntoSubsystem(page, 'auth-service');

    // Add a node using the command palette
    await page.keyboard.press('Control+k');
    // ... (add node steps depend on palette behavior)

    // Go back up
    await page.keyboard.press('Escape');

    // The RefNode's ref-node-slot should contain the child canvas
    const slot = page.locator('[data-testid="ref-node-slot-auth-service"]');
    await expect(slot).toBeVisible();

    // Verify the slot contains ReactFlow content (not SubsystemPreview mini-nodes)
    await expect(slot.locator('.react-flow')).toBeVisible();
  });

  test('breadcrumb jump: multi-level returns to root', async ({ page }) => {
    // Create nested subsystem
    await diveIntoSubsystem(page, 'auth-service');
    await createSubsystem(page, 'token-store', /store/i);
    await diveIntoSubsystem(page, 'token-store');

    // Breadcrumb: Root > auth-service > token-store
    await expect(page.locator('.breadcrumb')).toContainText('token-store');

    // Click Root in breadcrumb
    await page.locator('.breadcrumb').getByText('Root').click();

    // Should be back at root
    await expect(page.locator('.breadcrumb')).not.toContainText('auth-service');
  });
});
```

- [ ] Run: `npm run test:e2e-no-bridge`
- [ ] Expected: PASS (4 tests)

### Step 2: Run full existing E2E suite

- [ ] Run: `npm run test:e2e-no-bridge`
- [ ] Verify ALL existing tests pass. Key specs to watch:
  - `subsystem.spec.ts` — subsystem creation, "Dive In" context menu, breadcrumb navigation
  - `canvas-operations.spec.ts` — node adding, deletion, selection
  - `node-type-overlay.spec.ts` — drag-to-canvas

- [ ] If any fail, check for:
  - `data-testid="main-canvas"` selector scope issues (CanvasShell must keep this)
  - SubsystemPreview-related selectors (should no longer exist)
  - ReactFlowProvider-related setup differences

### Step 3: Run full unit test suite

- [ ] Run: `npm run test:unit -- --run`
- [ ] Expected: ALL PASS. Note the new test count (should be close to 1447 + new tests, minus SubsystemPreview tests).

### Step 4: Commit

- [ ] `git add test/e2e/canvas-transition.spec.ts`
- [ ] `git commit -m "test: add E2E tests for canvas transition animation"`

### Step 5: Final verification with playwright-cli

- [ ] Use the `playwright-cli` skill to visually verify the full flow:
  1. Open the app
  2. Create a subsystem
  3. Add nodes inside it
  4. Navigate back to root
  5. Verify the RefNode preview shows the child nodes
  6. Double-click to dive in — verify smooth expanding animation
  7. Press Escape — verify smooth collapsing animation
  8. Take screenshots for the progress doc
