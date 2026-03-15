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
export async function gotoEmptyProject(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__archcanvas_fileStore__;
    if (!store) throw new Error('fileStore not exposed on window');

    store.setState({
      fs: {
        getName: () => 'test-project',
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
