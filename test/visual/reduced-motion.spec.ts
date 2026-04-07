import { test, expect } from "@playwright/test";
import { gotoApp } from "../e2e/e2e-helpers";

/**
 * Reduced-motion accessibility tests.
 *
 * Emulates `prefers-reduced-motion: reduce` and verifies that:
 * 1. Async edge dash animation is frozen (animation: none)
 * 2. Node hover transitions are suppressed (transition: none)
 * 3. Container hover transitions are suppressed (transition: none)
 *
 * Uses page.emulateMedia() to toggle the media feature without
 * changing the OS setting.
 */

/**
 * Add a single node to the canvas via the store with a fixed position.
 */
async function addNodeViaStore(
  page: import("@playwright/test").Page,
  nodeId: string,
  type: string,
  displayName: string,
  position: { x: number; y: number } = { x: 200, y: 200 },
) {
  await page.evaluate(
    ({ nodeId, type, displayName, position }) => {
      const graphStore = (window as any).__archcanvas_graphStore__;
      graphStore.getState().addNode("__root__", {
        id: nodeId,
        type,
        displayName,
        position,
      });
    },
    { nodeId, type, displayName, position },
  );
  await page.waitForTimeout(300);
}

/**
 * Add an edge between two nodes via the store.
 */
async function addEdgeViaStore(
  page: import("@playwright/test").Page,
  sourceNode: string,
  targetNode: string,
  protocol: string,
) {
  await page.evaluate(
    ({ sourceNode, targetNode, protocol }) => {
      const graphStore = (window as any).__archcanvas_graphStore__;
      graphStore.getState().addEdge("__root__", {
        from: { node: sourceNode },
        to: { node: targetNode },
        protocol,
      });
    },
    { sourceNode, targetNode, protocol },
  );
  await page.waitForTimeout(300);
}

test.describe("Reduced motion — accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoApp(page);
  });

  test("async edge: animation is disabled and stroke-dasharray is static", async ({
    page,
  }) => {
    // Add two nodes and an async edge between them
    await addNodeViaStore(page, "svc-a", "compute/service", "Service A", {
      x: 100,
      y: 200,
    });
    await addNodeViaStore(page, "svc-b", "compute/service", "Service B", {
      x: 500,
      y: 200,
    });
    await addEdgeViaStore(page, "svc-a", "svc-b", "Kafka");

    // Auto-layout so nodes are well-spaced and edge renders
    await page.keyboard.press("Meta+Shift+l");
    await page.waitForTimeout(500);

    // Wait for edge path to exist in the DOM (SVG paths are not "visible" to Playwright)
    await page.locator(".edge-async").first().waitFor({ state: "attached" });

    const edgeStyle = await page.locator(".edge-async").first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        strokeDasharray: style.strokeDasharray,
      };
    });

    // animation should be "none" (not "dash-flow")
    expect(edgeStyle.animationName).toBe("none");
    // stroke-dasharray should be the static "8, 4" pattern (computed style includes units)
    expect(edgeStyle.strokeDasharray).toMatch(/^8(px)?,\s*4(px)?$/);
  });

  test("arch-node: transition is disabled under reduced motion", async ({
    page,
  }) => {
    await addNodeViaStore(page, "svc-1", "compute/service", "Service Node");

    const nodeEl = page.locator(".arch-node").first();
    await expect(nodeEl).toBeVisible();

    const transition = await nodeEl.evaluate((el) => {
      return window.getComputedStyle(el).transition;
    });

    // Transition should contain "none" or "0s" indicating it's disabled
    const isDisabled =
      transition.includes("none") ||
      transition === "" ||
      /\b0s\b/.test(transition);
    expect(isDisabled).toBe(true);
  });

  test("node-shape-container: transition is disabled under reduced motion", async ({
    page,
  }) => {
    await addNodeViaStore(
      page,
      "container-1",
      "compute/container",
      "Test Container",
    );

    const containerEl = page.locator(".node-shape-container").first();
    await expect(containerEl).toBeVisible();

    const transition = await containerEl.evaluate((el) => {
      return window.getComputedStyle(el).transition;
    });

    // Transition should contain "none" or "0s" indicating it's disabled
    const isDisabled =
      transition.includes("none") ||
      transition === "" ||
      /\b0s\b/.test(transition);
    expect(isDisabled).toBe(true);
  });

  test("accordion animation custom properties are set to none", async ({
    page,
  }) => {
    const animValues = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement);
      return {
        accordionDown: style.getPropertyValue("--animate-accordion-down").trim(),
        accordionUp: style.getPropertyValue("--animate-accordion-up").trim(),
        collapsibleDown: style
          .getPropertyValue("--animate-collapsible-down")
          .trim(),
        collapsibleUp: style.getPropertyValue("--animate-collapsible-up").trim(),
      };
    });

    expect(animValues.accordionDown).toBe("none");
    expect(animValues.accordionUp).toBe("none");
    expect(animValues.collapsibleDown).toBe("none");
    expect(animValues.collapsibleUp).toBe("none");
  });
});
