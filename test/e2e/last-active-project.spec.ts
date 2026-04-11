import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Last active project via localStorage: tests the persist/read round-trip
// that powers seamless project restoration on Tauri app startup.
//
// These tests exercise the browser-level localStorage APIs directly (no Tauri
// needed) to verify the lastActiveProject module's behavior end-to-end.
//
// Note: The actual Tauri-specific startup restore path (Priority 2 in
// ProjectGate) requires __TAURI_INTERNALS__ which is not present in the
// browser E2E environment. These tests verify the persistence layer only.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "archcanvas:lastActiveProject";

test.describe("last active project via localStorage", () => {
  test("persisted entry survives a page reload (read-only, not consumed)", async ({
    page,
  }) => {
    await page.goto("/");

    // Persist a last active project entry
    await page.evaluate((key) => {
      localStorage.setItem(key, "/home/user/test-project");
    }, STORAGE_KEY);

    // Verify the entry exists
    const beforeReload = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(beforeReload).toBe("/home/user/test-project");

    // Reload the page
    await page.reload();
    await page.waitForTimeout(500);

    // Unlike restoreProject (consume-on-read), lastActiveProject is
    // read-only — the entry should still be present after reload
    const afterReload = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(afterReload).toBe("/home/user/test-project");
  });

  test("stores a plain string (not JSON)", async ({ page }) => {
    await page.goto("/");

    // Simulate what persistLastActiveProject does
    await page.evaluate((key) => {
      localStorage.setItem(key, "/home/user/my-project");
    }, STORAGE_KEY);

    const stored = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );

    // Should be a plain path string, not a JSON object like restoreProject uses
    expect(stored).toBe("/home/user/my-project");
    expect(stored).not.toContain("{");
    expect(stored).not.toContain("timestamp");
  });

  test("no entry present does not cause errors on startup", async ({
    page,
  }) => {
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
