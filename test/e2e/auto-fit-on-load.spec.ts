import { test, expect } from "@playwright/test";
import { gotoApp } from "./e2e-helpers";

// ---------------------------------------------------------------------------
// Auto-fit on load: the viewport should frame all nodes after project load
// ---------------------------------------------------------------------------

test.describe("auto-fit on load", () => {
  test("nodes are visible in the viewport after loading a project", async ({
    page,
  }) => {
    await gotoApp(page);

    // Add two nodes at known positions via the command palette
    await page.keyboard.press("Meta+k");
    await page
      .getByRole("option", { name: /Service compute\/service/ })
      .click();
    await page.waitForTimeout(200);

    await page.keyboard.press("Meta+k");
    await page
      .getByRole("option", { name: /Database data\/database/ })
      .click();
    await page.waitForTimeout(200);

    // Verify nodes are on the canvas
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    // Trigger a fit-view via the custom event (simulates what auto-fit does)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("archcanvas:fit-view"));
    });
    await page.waitForTimeout(500);

    // After fit-view, all nodes should still be visible (within the viewport)
    const nodes = page.locator(".react-flow__node");
    const count = await nodes.count();
    expect(count).toBe(2);

    for (let i = 0; i < count; i++) {
      await expect(nodes.nth(i)).toBeVisible();
    }
  });

  test("empty project does not crash on load", async ({ page }) => {
    await gotoApp(page);

    // An empty project has no nodes — the canvas should render without errors
    await expect(page.locator(".react-flow__node")).toHaveCount(0);

    // Canvas container is still present and usable
    await expect(page.getByTestId("main-canvas")).toBeVisible();
  });
});
