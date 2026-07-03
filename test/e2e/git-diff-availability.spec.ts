import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';
import { openCommandPalette } from './helpers/keyboard';

/**
 * Gate test for the git-diff feature: when the bound FileSystem does not
 * expose a `.git` directory (or lacks the methods isomorphic-git needs),
 * `refreshDiffAvailability()` resolves `diffStore.available = false`, and
 * every diff entry point must be HIDDEN entirely — not merely disabled.
 *
 * `gotoApp()`'s stub FileSystem has no `stat()` method at all, so
 * `GitProvider.isRepository()` throws internally and is caught, resolving
 * to `false`. This exercises the real "no repo available" path end to end
 * through a production build (no mocking of diffStore/orchestrator).
 *
 * The "shown when available" path is covered by the Task 2/3 unit and
 * integration tests (diffStore, orchestrator, GitProvider) — this file only
 * asserts the "hidden" half of the gate, since standing up a real `.git`
 * fixture inside the web preview's virtual filesystem is impractical.
 */
test.describe('git diff availability gate', () => {
  test('Diff Overlay button is absent from the toolbar when no git repo is available', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.react-flow')).toBeVisible();

    await expect(page.getByRole('button', { name: /diff overlay/i })).toHaveCount(0);
  });

  test('Toggle/Clear Diff Overlay commands are absent from the command palette when unavailable', async ({ page }) => {
    await gotoApp(page);
    await openCommandPalette(page);
    await page.keyboard.type('>diff');

    // No matching command items, and cmdk falls back to its empty state.
    await expect(page.locator('[cmdk-item]')).toHaveCount(0);
    await expect(page.getByText('No results found.')).toBeVisible();
  });

  test('Cmd+Shift+D does not enable the diff overlay when unavailable', async ({ page }) => {
    await gotoApp(page);

    await page.keyboard.press('Meta+Shift+d');

    // No diff state should have been enabled — surfaced via the exposed
    // diffStore (used by other diff tests / dev tooling).
    const enabled = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__archcanvas_diffStore__;
      return store?.getState().enabled ?? null;
    });
    expect(enabled).toBe(false);
  });
});
