import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('NodeDef version selector', () => {
  const mockNodeDefs = {
    items: [{
      namespace: 'kubernetes', name: 'deployment',
      latestVer: '3.0.0', displayName: 'Kubernetes Deployment',
      description: 'Manages k8s deployments', tags: [], downloadCount: 1000
    }],
    total: 1,
  };

  const mockMultiVersionHistory = {
    versions: [
      { version: '3.0.0', publishedAt: '2026-04-01T00:00:00.000Z', downloadCount: 42 },
      { version: '2.0.0', publishedAt: '2026-02-01T00:00:00.000Z', downloadCount: 25 },
      { version: '1.0.0', publishedAt: '2026-01-15T00:00:00.000Z', downloadCount: 10 },
    ],
  };

  const mockSingleVersionHistory = {
    versions: [
      { version: '1.0.0', publishedAt: '2026-01-15T00:00:00.000Z', downloadCount: 5 },
    ],
  };

  const mockDetailLatest = {
    nodedef: { namespace: 'kubernetes', name: 'deployment', latestVer: '3.0.0',
               displayName: 'Kubernetes Deployment', description: 'Manages k8s deployments',
               tags: [], downloadCount: 1000 },
    version: { nodedefId: 'uuid-1', version: '3.0.0', blob: { _testMarker: 'latest-blob' },
               publishedAt: '2026-04-01T00:00:00.000Z' },
  };

  const mockDetailV1 = {
    nodedef: { namespace: 'kubernetes', name: 'deployment', latestVer: '3.0.0',
               displayName: 'Kubernetes Deployment', description: 'Manages k8s deployments',
               tags: [], downloadCount: 1000 },
    version: { nodedefId: 'uuid-2', version: '1.0.0', blob: { _testMarker: 'v1-blob' },
               publishedAt: '2026-01-15T00:00:00.000Z' },
  };

  test.beforeEach(async ({ page }) => {
    // Versions route — must be first (most specific)
    await page.route(
      'https://registry.archcanvas.dev/api/v1/nodedefs/kubernetes/deployment/versions',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMultiVersionHistory),
        });
      }
    );

    // Detail with ?version=1.0.0
    await page.route(
      'https://registry.archcanvas.dev/api/v1/nodedefs/kubernetes/deployment?version=1.0.0',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDetailV1),
        });
      }
    );

    // Detail without version param (exact, no version query)
    await page.route(
      'https://registry.archcanvas.dev/api/v1/nodedefs/kubernetes/deployment',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDetailLatest),
        });
      }
    );

    // Catch-all for browse
    await page.route(
      'https://registry.archcanvas.dev/api/v1/nodedefs*',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: mockNodeDefs.items, total: 1 }),
        });
      }
    );

    // Namespaces
    await page.route(
      'https://registry.archcanvas.dev/api/v1/namespaces',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ namespaces: [] }),
        });
      }
    );

    await gotoApp(page);
  });

  async function openNodeDefDetail(page: Page) {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await page.getByTestId('nodedef-card-kubernetes/deployment').click();
    // Wait for the detail panel
    await expect(page.getByTestId('detail-back-btn')).toBeVisible({ timeout: 5000 });
  }

  test('version history section is hidden for a NodeDef with one version', async ({ page }) => {
    // Override the versions route to return single version history
    await page.route(
      'https://registry.archcanvas.dev/api/v1/nodedefs/kubernetes/deployment/versions',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSingleVersionHistory),
        });
      }
    );

    await openNodeDefDetail(page);
    await expect(page.getByTestId('version-history-section')).not.toBeVisible({ timeout: 3000 });
  });

  test('version history section is visible for a NodeDef with multiple versions', async ({ page }) => {
    await openNodeDefDetail(page);
    await expect(page.getByTestId('version-history-section')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('version-row-3.0.0')).toBeVisible();
    await expect(page.getByTestId('version-row-2.0.0')).toBeVisible();
    await expect(page.getByTestId('version-row-1.0.0')).toBeVisible();
  });

  test('currently displayed version is highlighted in the list', async ({ page }) => {
    await openNodeDefDetail(page);
    await expect(page.getByTestId('version-history-section')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('version-row-3.0.0')).toHaveClass(/font-semibold/);
    await expect(page.getByTestId('version-row-1.0.0')).not.toHaveClass(/font-semibold/);
  });

  test('clicking a version row fetches that version\'s spec', async ({ page }) => {
    await openNodeDefDetail(page);
    await expect(page.getByTestId('version-history-section')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('version-row-1.0.0').click();
    await page.waitForResponse((resp) => resp.url().includes('?version=1.0.0'));
    await expect(page.getByTestId('detail-back-btn')).toBeVisible();
  });

  test('selected version row becomes highlighted after click', async ({ page }) => {
    await openNodeDefDetail(page);
    await expect(page.getByTestId('version-history-section')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('version-row-1.0.0').click();
    await expect(page.getByTestId('version-row-1.0.0')).toHaveClass(/font-semibold/, { timeout: 5000 });
    await expect(page.getByTestId('version-row-3.0.0')).not.toHaveClass(/font-semibold/);
  });

  test('install snippet updates to reflect selected version', async ({ page }) => {
    await openNodeDefDetail(page);
    await expect(page.getByTestId('version-history-section')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('code').filter({ hasText: 'kubernetes/deployment@3.0.0' })).toBeVisible();
    await page.getByTestId('version-row-1.0.0').click();
    await page.waitForResponse((resp) => resp.url().includes('?version=1.0.0'));
    await expect(page.locator('code').filter({ hasText: 'kubernetes/deployment@1.0.0' })).toBeVisible({ timeout: 5000 });
  });

  test('URL updates to include ?version= after clicking a version row', async ({ page }) => {
    await openNodeDefDetail(page);
    await expect(page.getByTestId('version-history-section')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('version-row-1.0.0').click();
    await expect(page).toHaveURL(/version=1\.0\.0/, { timeout: 5000 });
    await expect(page).toHaveURL(/nodedef=kubernetes%2Fdeployment/, { timeout: 5000 });
  });

  test('loading page with ?nodedef=&version= opens detail at that version', async ({ page }) => {
    await gotoApp(page, '/?nodedef=kubernetes%2Fdeployment&version=1.0.0');
    await expect(page.getByTestId('detail-back-btn')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('version-history-section')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('version-row-1.0.0')).toHaveClass(/font-semibold/, { timeout: 5000 });
  });
});
