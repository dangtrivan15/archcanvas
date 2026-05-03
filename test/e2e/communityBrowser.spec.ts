import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('community browser panel', () => {
  const mockNodeDefs = {
    items: [
      {
        namespace: 'kubernetes',
        name: 'deployment',
        latestVer: '2.1.0',
        displayName: 'Kubernetes Deployment',
        description: 'Manages k8s deployments',
        tags: ['k8s'],
        downloadCount: 1543,
      },
      {
        namespace: 'aws',
        name: 's3-bucket',
        latestVer: '1.0.0',
        displayName: 'S3 Bucket',
        description: 'AWS S3 storage',
        tags: ['aws'],
        downloadCount: 800,
      },
    ],
    total: 2,
  };

  const mockNamespaces = {
    namespaces: [
      { namespace: 'kubernetes', count: 5 },
      { namespace: 'aws', count: 3 },
    ],
  };

  test.beforeEach(async ({ page }) => {
    await page.route('https://registry.archcanvas.dev/api/v1/nodedefs*', async (route) => {
      const url = new URL(route.request().url());
      const ns = url.searchParams.get('namespace');
      if (ns === 'kubernetes') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: mockNodeDefs.items.filter((i) => i.namespace === 'kubernetes'),
            total: 1,
          }),
        });
      } else if (url.pathname.endsWith('/deployment')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nodedef: mockNodeDefs.items[0],
            version: {
              nodedefId: 'uuid-1',
              version: '2.1.0',
              blob: {},
              publishedAt: '2026-01-01T00:00:00.000Z',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockNodeDefs),
        });
      }
    });

    await page.route('https://registry.archcanvas.dev/api/v1/namespaces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNamespaces),
      });
    });

    await gotoApp(page);
  });

  test('registry panel opens via status bar registry button', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await expect(page.getByTestId('tab-installed')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('tab-community')).toBeVisible();
  });

  test('community tab shows download counts', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await expect(page.getByText('1543 downloads')).toBeVisible({ timeout: 3000 });
  });

  test('namespace filter narrows results', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await page.getByTestId('namespace-filter-kubernetes').click();
    await expect(page.getByTestId('nodedef-card-aws/s3-bucket')).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByText('kubernetes/deployment')).toBeVisible();
  });

  test('all three sort buttons are visible in the community tab', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await expect(page.getByTestId('sort-downloads')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('sort-recent')).toBeVisible();
    await expect(page.getByTestId('sort-name')).toBeVisible();
  });

  test('clicking "Recently updated" makes that button active', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await page.getByTestId('sort-recent').click();
    // The active sort button has bg-muted and font-medium classes
    await expect(page.getByTestId('sort-recent')).toHaveClass(/font-medium/, { timeout: 2000 });
  });

  test('URL contains ?sort=recent after clicking Recently updated', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await page.getByTestId('sort-recent').click();
    await expect(page).toHaveURL(/sort=recent/, { timeout: 2000 });
  });

  test('loading the page with ?sort=recent in URL pre-selects Recently updated', async ({ page }) => {
    await gotoApp(page, '/?sort=recent');
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await page.waitForResponse(r => r.url().includes('/api/v1/nodedefs'));
    await expect(page.getByTestId('sort-recent')).toHaveClass(/font-medium/, { timeout: 3000 });
  });
});
