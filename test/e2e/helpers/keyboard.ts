import type { Page } from '@playwright/test';

const isMac = process.platform === 'darwin';

/**
 * Open the command palette using the platform-appropriate keyboard shortcut.
 * Uses Meta+K on macOS and Control+K on Linux/Windows.
 */
export async function openCommandPalette(page: Page): Promise<void> {
  if (isMac) {
    await page.keyboard.press('Meta+k');
  } else {
    await page.keyboard.press('Control+k');
  }
}
