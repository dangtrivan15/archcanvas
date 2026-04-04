import { test, expect } from "@playwright/test";
import { gotoApp } from "./e2e-helpers";

// ---------------------------------------------------------------------------
// Helper: Add a node via command palette and wait for it to appear
// ---------------------------------------------------------------------------
async function addNode(
  page: import("@playwright/test").Page,
  pattern: RegExp,
) {
  await page.keyboard.press("Meta+k");
  await page.getByRole("option", { name: pattern }).click();
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Helper: Select a node by clicking on it
// ---------------------------------------------------------------------------
async function clickNode(
  page: import("@playwright/test").Page,
  index: number,
) {
  const node = page.locator(".react-flow__node").nth(index);
  await node.click();
  await page.waitForTimeout(100);
}

// ---------------------------------------------------------------------------
// Clipboard — Copy / Paste / Cut / Duplicate
// ---------------------------------------------------------------------------

test.describe("clipboard operations", () => {
  test("Cmd+C → Cmd+V copies a node", async ({ page }) => {
    await gotoApp(page);

    // Add a node
    await addNode(page, /Service compute\/service/);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Select the node
    await clickNode(page, 0);

    // Copy
    await page.keyboard.press("Meta+c");

    // Paste
    await page.keyboard.press("Meta+v");
    await page.waitForTimeout(200);

    // Should now have 2 nodes
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.getByTestId("node-count")).toHaveAttribute(
      "data-count",
      "2",
    );
  });

  test("Cmd+X cuts a node (removes original, clipboard populated)", async ({
    page,
  }) => {
    await gotoApp(page);

    // Add a single node to avoid overlap issues
    await addNode(page, /Service compute\/service/);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Select the node
    await clickNode(page, 0);

    // Cut
    await page.keyboard.press("Meta+x");
    await page.waitForTimeout(200);

    // Should have 0 nodes (the node was cut)
    await expect(page.locator(".react-flow__node")).toHaveCount(0);

    // Paste the cut node back
    await page.keyboard.press("Meta+v");
    await page.waitForTimeout(200);

    // Should now have 1 node again
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("Cmd+D duplicates selected node", async ({ page }) => {
    await gotoApp(page);

    // Add a node
    await addNode(page, /Service compute\/service/);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Select the node
    await clickNode(page, 0);

    // Duplicate
    await page.keyboard.press("Meta+d");
    await page.waitForTimeout(200);

    // Should now have 2 nodes
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.getByTestId("node-count")).toHaveAttribute(
      "data-count",
      "2",
    );
  });

  test("paste with empty clipboard is a no-op", async ({ page }) => {
    await gotoApp(page);

    // Add a node (but don't copy anything)
    await addNode(page, /Service compute\/service/);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Paste with empty clipboard
    await page.keyboard.press("Meta+v");
    await page.waitForTimeout(200);

    // Should still have 1 node
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("duplicate with no selection is a no-op", async ({ page }) => {
    await gotoApp(page);

    await addNode(page, /Service compute\/service/);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Clear selection
    await page.keyboard.press("Escape");

    // Duplicate with no selection
    await page.keyboard.press("Meta+d");
    await page.waitForTimeout(200);

    // Still 1 node
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("paste then undo removes pasted node", async ({ page }) => {
    await gotoApp(page);

    await addNode(page, /Service compute\/service/);
    await clickNode(page, 0);

    // Copy + paste
    await page.keyboard.press("Meta+c");
    await page.keyboard.press("Meta+v");
    await page.waitForTimeout(200);
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    // Undo should remove the pasted node
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(200);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("copy + paste multiple times creates multiple copies", async ({
    page,
  }) => {
    await gotoApp(page);

    await addNode(page, /Service compute\/service/);
    await clickNode(page, 0);

    // Copy
    await page.keyboard.press("Meta+c");

    // Paste 3 times
    await page.keyboard.press("Meta+v");
    await page.waitForTimeout(200);
    await page.keyboard.press("Meta+v");
    await page.waitForTimeout(200);
    await page.keyboard.press("Meta+v");
    await page.waitForTimeout(200);

    // Should have 4 nodes (1 original + 3 pastes)
    await expect(page.locator(".react-flow__node")).toHaveCount(4);
  });

  test("select-all + duplicate doubles all nodes", async ({ page }) => {
    await gotoApp(page);

    // Add 2 nodes
    await addNode(page, /Service compute\/service/);
    await addNode(page, /Database data\/database/);
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    // Select all
    await page.keyboard.press("Meta+a");

    // Duplicate
    await page.keyboard.press("Meta+d");
    await page.waitForTimeout(200);

    // Should have 4 nodes
    await expect(page.locator(".react-flow__node")).toHaveCount(4);
    await expect(page.getByTestId("node-count")).toHaveAttribute(
      "data-count",
      "4",
    );
  });
});
