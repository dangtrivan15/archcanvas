import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';
import { openCommandPalette } from './helpers/keyboard';

test.describe('community registry install', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept registry search endpoint
    await page.route('https://registry.archcanvas.dev/api/v1/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            namespace: 'community',
            name: 'kubernetes-deployment',
            version: '1.0.0',
            displayName: 'Kubernetes Deployment',
            description: 'A K8s Deployment node',
          },
        ]),
      });
    });

    // Intercept YAML download endpoint
    await page.route(
      'https://registry.archcanvas.dev/api/v1/nodedefs/community/kubernetes-deployment/1.0.0/yaml',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/yaml',
          body: [
            'kind: NodeDef',
            'apiVersion: v1',
            'metadata:',
            '  name: kubernetes-deployment',
            '  namespace: community',
            '  version: "1.0.0"',
            '  displayName: Kubernetes Deployment',
            '  description: A K8s Deployment node',
            '  icon: Box',
            '  shape: rectangle',
            'spec:',
            '  ports: []',
          ].join('\n'),
        });
      }
    );

    await gotoApp(page);
  });

  test('community results appear with [community] label', async ({ page }) => {
    await openCommandPalette(page);
    await page.keyboard.type('+kubernetes');
    await expect(
      page.locator('[cmdk-item]').filter({ hasText: '[community]' })
    ).toBeVisible({ timeout: 2000 });
  });

  test('selecting community result opens install dialog', async ({ page }) => {
    await openCommandPalette(page);
    await page.keyboard.type('+kubernetes');
    await page.locator('[cmdk-item]').filter({ hasText: '[community]' }).click();
    await expect(page.getByRole('dialog')).toContainText('Install Community NodeDef');
    await expect(page.getByRole('dialog')).toContainText('community/kubernetes-deployment');
  });

  test('confirming install closes dialog', async ({ page }) => {
    await openCommandPalette(page);
    await page.keyboard.type('+kubernetes');
    await page.locator('[cmdk-item]').filter({ hasText: '[community]' }).click();
    await page.getByTestId('install-nodedef-confirm').click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('offline: shows fallback notice, no crash', async ({ page }) => {
    // Override search route to simulate offline
    await page.route('https://registry.archcanvas.dev/**', (route) => route.abort('failed'));
    await openCommandPalette(page);
    await page.keyboard.type('+kubernetes');
    // Notice should appear, not a hard error
    await expect(
      page.locator('text=/registry unavailable/i')
    ).toBeVisible({ timeout: 2000 });
    // Built-in results still shown
    await expect(page.locator('[cmdk-group]')).toBeVisible();
  });

  test('community results do not appear in action search (> prefix)', async ({ page }) => {
    await openCommandPalette(page);
    await page.keyboard.type('>kubernetes');
    // Wait briefly — remote search must not fire
    await page.waitForTimeout(500);
    await expect(
      page.locator('[cmdk-item]').filter({ hasText: '[community]' })
    ).not.toBeVisible();
  });
});
