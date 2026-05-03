import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('tag filter', () => {
  const mockNodeDefs = {
    items: [
      {
        namespace: 'kubernetes',
        name: 'deployment',
        latestVer: '2.1.0',
        displayName: 'Kubernetes Deployment',
        description: 'Manages k8s deployments',
        tags: ['k8s', 'cloud'],
        downloadCount: 1543,
      },
      {
        namespace: 'aws',
        name: 's3-bucket',
        latestVer: '1.0.0',
        displayName: 'S3 Bucket',
        description: 'AWS S3 storage',
        tags: ['aws', 'cloud'],
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

  const mockTags = {
    tags: [
      { tag: 'k8s', count: 5 },
      { tag: 'aws', count: 3 },
      { tag: 'cloud', count: 8 },
    ],
  };

  test.beforeEach(async ({ page }) => {
    await page.route('https://registry.archcanvas.dev/api/v1/nodedefs*', async (route) => {
      const url = new URL(route.request().url());
      const tag = url.searchParams.get('tag');
      if (tag === 'k8s') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: mockNodeDefs.items.filter((i) => i.tags.includes('k8s')),
            total: 1,
          }),
        });
      } else if (tag === 'aws') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: mockNodeDefs.items.filter((i) => i.tags.includes('aws')),
            total: 1,
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

    await page.route('https://registry.archcanvas.dev/api/v1/tags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTags),
      });
    });

    await gotoApp(page);
  });

  test('tag filter pills are visible when tags are returned', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await expect(page.getByTestId('tag-filter-all')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('tag-filter-k8s')).toBeVisible();
    await expect(page.getByTestId('tag-filter-aws')).toBeVisible();
    await expect(page.getByTestId('tag-filter-cloud')).toBeVisible();
  });

  test('clicking a tag pill filters results to that tag', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await page.getByTestId('tag-filter-k8s').click();
    await expect(page.getByTestId('nodedef-card-kubernetes/deployment')).toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId('nodedef-card-aws/s3-bucket')).not.toBeVisible();
  });

  test('clicking "All" pill resets tag filter', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await page.getByTestId('tag-filter-k8s').click();
    await page.getByTestId('tag-filter-all').click();
    await expect(page.getByTestId('nodedef-card-kubernetes/deployment')).toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId('nodedef-card-aws/s3-bucket')).toBeVisible();
  });

  test('URL contains ?tag= after clicking a tag pill', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await page.getByTestId('tag-filter-k8s').click();
    await expect(page).toHaveURL(/tag=k8s/, { timeout: 2000 });
  });

  test('tag chips on card are visible', async ({ page }) => {
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await expect(page.getByTestId('nodedef-card-kubernetes/deployment')).toBeVisible({ timeout: 3000 });
    // The card for kubernetes/deployment should show its tags as chips
    const card = page.getByTestId('nodedef-card-kubernetes/deployment');
    await expect(card.getByText('k8s')).toBeVisible();
  });

  test('tag filter is hidden when tags endpoint returns empty', async ({ page }) => {
    // Override to return empty tags
    await page.route('https://registry.archcanvas.dev/api/v1/tags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tags: [] }),
      });
    });

    await gotoApp(page);
    await page.getByTestId('registry-indicator').click();
    await page.getByTestId('tab-community').click();
    await expect(page.getByTestId('tag-filter-all')).not.toBeVisible({ timeout: 2000 });
  });
});
