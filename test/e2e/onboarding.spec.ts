import { test, expect } from '@playwright/test';
import { gotoApp, gotoEmptyProject } from './e2e-helpers';

test.describe('onboarding wizard', () => {
  test('wizard appears for empty project', async ({ page }) => {
    await gotoEmptyProject(page);

    // Wizard visible — both init-method options should be present
    await expect(page.getByText('AI Analyze')).toBeVisible();
    await expect(page.getByText('Blank Canvas')).toBeVisible();

    // Canvas NOT visible
    await expect(page.locator('.react-flow')).not.toBeVisible();
  });

  test('blank canvas button is clickable', async ({ page }) => {
    await gotoEmptyProject(page);

    // Verify the Blank Canvas button exists and is clickable.
    // The full completion flow is tested by unit tests — E2E just
    // verifies the wizard UI renders and buttons are interactive.
    const blankBtn = page.getByText('Blank Canvas');
    await expect(blankBtn).toBeVisible();
    await expect(blankBtn).toBeEnabled();
    await blankBtn.click();
    // No crash — the stub fs will cause completeOnboarding to write
    // files that disappear (exists() always returns false), so the
    // wizard may reappear, but no errors should occur.
  });

  test('AI Analyze advances to survey step', async ({ page }) => {
    await gotoEmptyProject(page);

    await page.getByText('AI Analyze').click();

    // Step 2 should be visible — survey form
    await expect(page.getByText('Configure AI Analysis')).toBeVisible();
    await expect(
      page.getByPlaceholder(/Describe what this project does/i),
    ).toBeVisible();
  });

  test('back from survey returns to step 1', async ({ page }) => {
    await gotoEmptyProject(page);

    // Go to Step 2
    await page.getByText('AI Analyze').click();
    await expect(
      page.getByPlaceholder(/Describe what this project does/i),
    ).toBeVisible();

    // Click Back
    await page.getByText('Back').click();

    // Step 1 visible again
    await expect(page.getByText('AI Analyze')).toBeVisible();
    await expect(page.getByText('Blank Canvas')).toBeVisible();
  });

  test('existing project skips wizard', async ({ page }) => {
    await gotoApp(page);

    // Canvas visible, wizard NOT
    await expect(page.locator('.react-flow')).toBeVisible();
    // The wizard welcome text should not be present
    await expect(page.getByText('Welcome to ArchCanvas')).not.toBeVisible();
  });
});
