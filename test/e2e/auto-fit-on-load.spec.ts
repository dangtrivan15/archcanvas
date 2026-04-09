import { test, expect } from "@playwright/test";
import { gotoApp } from "./e2e-helpers";

// ---------------------------------------------------------------------------
// Auto-fit on load: verify the viewport frames all nodes when a project with
// existing content is loaded (Canvas mounts with nodes already in the store).
// ---------------------------------------------------------------------------

test.describe("auto-fit on load", () => {
  test("fits nodes into viewport when project loads with existing nodes", async ({
    page,
  }) => {
    await gotoApp(page);

    // Step 1: Add two nodes interactively (this populates the project data)
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

    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    // Step 2: Simulate a project reload — set status to 'loading' which
    // unmounts the Canvas component (App renders ProjectGate instead).
    await page.evaluate(() => {
      const store = (window as any).__archcanvas_fileStore__;
      store.setState({ status: "loading" });
    });
    await page.waitForTimeout(200);

    // Canvas should be unmounted (ProjectGate shown)
    await expect(page.locator("[data-testid='main-canvas']")).toHaveCount(0);

    // Step 3: Set status back to 'loaded' — Canvas remounts. Because nodes
    // are already in the store, the Canvas mounts with nodes present,
    // triggering the auto-fit effect.
    await page.evaluate(() => {
      const store = (window as any).__archcanvas_fileStore__;
      store.setState({ status: "loaded" });
    });

    // Wait for the auto-fit animation (300ms duration + rAF delay)
    await page.waitForTimeout(600);

    // Step 4: Verify both nodes are visible within the ReactFlow container
    const container = page.locator(".react-flow");
    const containerBox = await container.boundingBox();
    expect(containerBox).not.toBeNull();

    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(2);

    for (let i = 0; i < 2; i++) {
      const nodeBox = await nodes.nth(i).boundingBox();
      expect(nodeBox).not.toBeNull();

      // Node should be within the visible area of the ReactFlow container
      expect(nodeBox!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
      expect(nodeBox!.y).toBeGreaterThanOrEqual(containerBox!.y - 1);
      expect(nodeBox!.x + nodeBox!.width).toBeLessThanOrEqual(
        containerBox!.x + containerBox!.width + 1,
      );
      expect(nodeBox!.y + nodeBox!.height).toBeLessThanOrEqual(
        containerBox!.y + containerBox!.height + 1,
      );
    }
  });

  test("does not auto-fit when nodes are added interactively to empty project", async ({
    page,
  }) => {
    await gotoApp(page);

    // Canvas mounts empty — mountedWithNodes is false. Adding a node
    // interactively should NOT trigger auto-fit (no viewport jump).

    // Record the initial viewport transform
    const beforeTransform = await page.evaluate(() => {
      const wrapper = document.querySelector(
        ".react-flow__viewport",
      ) as HTMLElement;
      return wrapper?.style.transform ?? "";
    });

    // Add a node interactively
    await page.keyboard.press("Meta+k");
    await page
      .getByRole("option", { name: /Service compute\/service/ })
      .click();
    await page.waitForTimeout(500);

    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Viewport should NOT have changed (auto-fit did not fire)
    const afterTransform = await page.evaluate(() => {
      const wrapper = document.querySelector(
        ".react-flow__viewport",
      ) as HTMLElement;
      return wrapper?.style.transform ?? "";
    });

    expect(afterTransform).toBe(beforeTransform);
  });

  test("empty project does not crash on load", async ({ page }) => {
    await gotoApp(page);

    // An empty project has no nodes — the canvas should render without errors
    await expect(page.locator(".react-flow__node")).toHaveCount(0);

    // Canvas container is still present and usable
    await expect(page.getByTestId("main-canvas")).toBeVisible();
  });

  test("auto-fit fires again after project reload (Canvas remount)", async ({
    page,
  }) => {
    await gotoApp(page);

    // Add two nodes
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

    // Simulate project reload cycle: loading → loaded
    await page.evaluate(() => {
      const store = (window as any).__archcanvas_fileStore__;
      store.setState({ status: "loading" });
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const store = (window as any).__archcanvas_fileStore__;
      store.setState({ status: "loaded" });
    });
    await page.waitForTimeout(600);

    // After remount, auto-fit should have fired again — nodes visible
    await expect(page.getByTestId("main-canvas")).toBeVisible();
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(2);

    // Verify nodes are within the container bounds
    const containerBox = await page.locator(".react-flow").boundingBox();
    for (let i = 0; i < 2; i++) {
      const nodeBox = await nodes.nth(i).boundingBox();
      expect(nodeBox).not.toBeNull();
      expect(nodeBox!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
      expect(nodeBox!.y).toBeGreaterThanOrEqual(containerBox!.y - 1);
    }
  });
});
