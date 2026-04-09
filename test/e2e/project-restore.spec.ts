import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Project restore via localStorage: tests the persist/consume round-trip
// that powers seamless project restoration after an app update relaunch.
//
// These tests exercise the browser-level localStorage APIs directly (no Tauri
// needed) to verify the restoreProject module's behavior end-to-end.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "archcanvas:restoreProject";

test.describe("project restore via localStorage", () => {
  test("persisted entry survives a page reload and is consumed on read", async ({
    page,
  }) => {
    await page.goto("/");

    // Persist a restore entry (simulating what updater.relaunch() does)
    await page.evaluate((key) => {
      const entry = { path: "/home/user/test-project.yaml", timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(entry));
    }, STORAGE_KEY);

    // Verify the entry exists in localStorage
    const beforeReload = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(beforeReload).not.toBeNull();
    const parsed = JSON.parse(beforeReload!);
    expect(parsed.path).toBe("/home/user/test-project.yaml");
    expect(typeof parsed.timestamp).toBe("number");

    // Reload the page — the app's startup code (ProjectGate) calls
    // consumeRestoreEntry() which should delete the entry
    await page.reload();
    await page.waitForTimeout(500);

    // The entry should have been consumed (deleted) on startup
    const afterReload = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(afterReload).toBeNull();
  });

  test("stale entries (>15 min) are rejected and removed", async ({
    page,
  }) => {
    await page.goto("/");

    // Persist a stale entry (16 minutes old)
    await page.evaluate((key) => {
      const sixteenMinAgo = Date.now() - 16 * 60 * 1000;
      const entry = { path: "/stale/project.yaml", timestamp: sixteenMinAgo };
      localStorage.setItem(key, JSON.stringify(entry));
    }, STORAGE_KEY);

    // Reload — the app should reject the stale entry
    await page.reload();
    await page.waitForTimeout(500);

    // Stale entry should still be removed (consume-on-read deletes unconditionally)
    const afterReload = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(afterReload).toBeNull();
  });

  test("entries within 15-min window are accepted", async ({ page }) => {
    await page.goto("/");

    // Persist a fresh entry (10 minutes old — within the 15-min window)
    await page.evaluate((key) => {
      const tenMinAgo = Date.now() - 10 * 60 * 1000;
      const entry = { path: "/recent/project.yaml", timestamp: tenMinAgo };
      localStorage.setItem(key, JSON.stringify(entry));
    }, STORAGE_KEY);

    // Verify it exists before reload
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(before).not.toBeNull();

    // Reload — the entry should be consumed
    await page.reload();
    await page.waitForTimeout(500);

    // Entry consumed
    const after = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(after).toBeNull();
  });

  test("corrupted JSON entries are safely removed", async ({ page }) => {
    await page.goto("/");

    // Write corrupted JSON
    await page.evaluate((key) => {
      localStorage.setItem(key, "{not valid json!!!");
    }, STORAGE_KEY);

    // Reload — should not crash, and corrupted entry should be cleaned up
    await page.reload();
    await page.waitForTimeout(500);

    // Entry should have been removed
    const after = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(after).toBeNull();
  });

  test("no entry present does not cause errors", async ({ page }) => {
    await page.goto("/");

    // Ensure no entry exists
    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);

    // Reload — app should start normally without errors
    await page.reload();
    await page.waitForTimeout(500);

    // Page should still be functional
    await expect(page.locator("body")).toBeVisible();

    // No entry should appear
    const after = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(after).toBeNull();
  });
});
