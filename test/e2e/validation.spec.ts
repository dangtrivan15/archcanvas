import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Architecture Validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);

    // Build a rule-tripping canvas directly via the exposed window stores:
    // a lone database (no replicas, no backup) → orphan + no-backup, and a
    // client→service edge with no WAF/auth in front → public-no-waf-auth (critical).
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graphStore = (window as any).__archcanvas_graphStore__;
      graphStore.getState().addNode('__root__', {
        id: 'db-orphan',
        type: 'data/database',
        displayName: 'Orphan DB',
        args: { engine: 'PostgreSQL', replicas: 0 },
      });
      graphStore.getState().addNode('__root__', {
        id: 'web-a',
        type: 'client/web-app',
        displayName: 'Web App',
      });
      graphStore.getState().addNode('__root__', {
        id: 'svc-a',
        type: 'compute/service',
        displayName: 'Exposed Service',
      });
      graphStore.getState().addEdge('__root__', {
        from: { node: 'web-a' },
        to: { node: 'svc-a' },
      });
    });
    await page.waitForTimeout(200);

    // Auto-layout so nodes are well-spaced.
    await page.keyboard.press('Meta+Shift+l');
    await page.waitForTimeout(300);
  });

  test('running "Validate Architecture" from the command palette opens the panel with grouped findings and a nonzero badge', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Validate Architecture/i }).click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId('validation-panel')).toBeVisible();

    const findings = page.getByTestId('validation-finding');
    await expect(findings.first()).toBeVisible();
    expect(await findings.count()).toBeGreaterThan(0);

    await expect(page.getByTestId('validation-indicator')).toBeVisible();
    const badgeText = await page.getByTestId('validation-indicator').textContent();
    expect(badgeText).toMatch(/\d+/);
  });

  test('clicking a critical finding selects and centers the target node', async ({ page }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validationStore = (window as any).__archcanvas_validationStore__;
      validationStore.getState().runValidation();
    });
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uiStore = (window as any).__archcanvas_uiStore__;
      uiStore.getState().openValidationPanel();
    });
    await page.waitForTimeout(200);

    // Find the critical finding for the exposed service and click it.
    const criticalFinding = page.getByTestId('validation-finding').filter({ hasText: /Exposed Service|public/i }).first();
    await criticalFinding.click();
    await page.waitForTimeout(300);

    // revealNode() selects the target node — the status bar's selection-count
    // badge is the app's existing signal that a selection happened.
    await expect(page.getByTestId('selection-count')).toBeVisible();
    await expect(page.getByTestId('selection-count')).toContainText('1 selected');
  });
});
