import type { Page } from '@playwright/test';

/**
 * Navigate to the app and bypass the ProjectGate by initializing
 * an empty in-memory project with a stub FileSystem.
 *
 * E2E tests can't interact with native file pickers, so this helper
 * sets up the Zustand store directly via page.evaluate. The store is
 * exposed on `window.__archcanvas_fileStore__` by fileStore.ts.
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__archcanvas_fileStore__;
    if (!store) throw new Error('fileStore not exposed on window');

    // Create an empty project (same as the old app bootstrap behavior)
    store.getState().initializeEmptyProject();

    // Set a stub FileSystem so the gate check (fs !== null) passes.
    // E2E tests don't persist files — the stub is sufficient.
    store.setState({
      fs: {
        getName: () => 'test-project',
        getPath: () => null,
        readFile: async () => '',
        writeFile: async () => {},
        exists: async () => false,
        mkdir: async () => {},
        listFiles: async () => [],
      },
    });
  });

  // Wait for React to re-render past the gate
  await page.waitForTimeout(100);
}

/**
 * Reset to an empty project via the store (replaces the old
 * File > New Project menu click which now opens a native dialog).
 */
export async function resetToEmptyProject(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__archcanvas_fileStore__;
    store.getState().initializeEmptyProject();
    // Clear dirty canvases and keep the stub fs
    store.setState({ dirtyCanvases: new Set() });
  });
  await page.waitForTimeout(100);
}

/**
 * Set up the app in needs_onboarding state (simulating opening an empty directory).
 * The wizard should appear instead of the canvas.
 */
/**
 * Create a subsystem via the context menu.
 * Opens context menu → picks "Create Subsystem..." → picks type → fills name dialog → creates.
 */
export async function createSubsystem(
  page: Page,
  name: string,
  typePattern: RegExp,
): Promise<void> {
  // Open palette in subsystem mode via context menu on canvas background
  const canvas = page.locator('.react-flow__pane');
  await canvas.click({ button: 'right', position: { x: 200, y: 200 } });
  await page.getByText('Create Subsystem...').click();

  // Pick the node type
  await page.getByRole('option', { name: typePattern }).click();

  // Fill the dialog
  await page.getByTestId('subsystem-name-input').fill(name);
  await page.getByTestId('subsystem-create-btn').click();

  // Wait for dialog to close and node to appear
  await page.waitForTimeout(200);
}

/**
 * Dive into a subsystem via context menu on a RefNode.
 */
export async function diveIntoSubsystem(
  page: Page,
  nodeText: string,
): Promise<void> {
  const node = page.locator('.react-flow__node').filter({ hasText: nodeText });
  await node.click({ button: 'right' });
  await page.getByRole('button', { name: 'Dive In' }).click();
  // Wait for navigation animation
  await page.waitForTimeout(700);
}

/**
 * Get the current breadcrumb text.
 */
export async function getBreadcrumbText(page: Page): Promise<string> {
  const breadcrumb = page.locator('[data-testid="breadcrumb"]');
  return breadcrumb.innerText();
}

export async function gotoEmptyProject(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__archcanvas_fileStore__;
    if (!store) throw new Error('fileStore not exposed on window');

    store.setState({
      fs: {
        getName: () => 'test-project',
        getPath: () => null,
        readFile: async () => '',
        writeFile: async () => {},
        exists: async () => false,
        mkdir: async () => {},
        listFiles: async () => [],
      },
      status: 'needs_onboarding',
      project: null,
      error: null,
    });
  });
  await page.waitForTimeout(100);
}
