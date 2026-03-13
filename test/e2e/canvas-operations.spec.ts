import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fix 4: Empty project bootstrap — canvas is immediately usable
// ---------------------------------------------------------------------------

test.describe("project bootstrap", () => {
  test("app starts with a loaded project (not idle)", async ({ page }) => {
    await page.goto("/");

    // Status bar should show scope info, not "No project open"
    // Scope to the status bar (bottom bar) to avoid matching breadcrumb "Root"
    const statusBar = page.locator("div.h-6.border-t");
    await expect(statusBar.getByText("Root")).toBeVisible();
    await expect(statusBar.getByText(/\d+ nodes/)).toBeVisible();
  });

  test("add node via command palette creates a node on canvas", async ({
    page,
  }) => {
    await page.goto("/");

    // Start with 0 nodes
    const initialCount = await page.locator(".react-flow__node").count();
    expect(initialCount).toBe(0);

    // Open palette and select Service
    await page.keyboard.press("Meta+k");
    await page
      .getByRole("option", { name: /Service compute\/service/ })
      .click();

    // Node should appear
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Status bar should reflect the new node
    await expect(page.getByText(/1 nodes?/)).toBeVisible();
  });

  test("add multiple nodes via command palette", async ({ page }) => {
    await page.goto("/");

    const nodeTypes = [
      /Service compute\/service/,
      /Database data\/database/,
      /Message Queue messaging\/message-queue/,
    ];

    for (const pattern of nodeTypes) {
      await page.keyboard.press("Meta+k");
      await page.getByRole("option", { name: pattern }).click();
      // Brief wait for state to settle
      await page.waitForTimeout(200);
    }

    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.getByText(/3 nodes/)).toBeVisible();
  });

  test("New Project resets the canvas", async ({ page }) => {
    await page.goto("/");

    // Add a node first
    await page.keyboard.press("Meta+k");
    await page
      .getByRole("option", { name: /Service compute\/service/ })
      .click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // File → New Project
    await page.getByRole("menuitem", { name: "File" }).click();
    await page.getByRole("menuitem", { name: /New Project/ }).click();

    // Canvas should be empty again
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(page.getByText(/0 nodes/)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Fix 5: Context menu wiring — Add Node + Auto Layout
// ---------------------------------------------------------------------------

test.describe("context menu actions", () => {
  test("Add Node opens the command palette", async ({ page }) => {
    await page.goto("/");

    // Right-click canvas
    const canvas = page.locator(".react-flow");
    await canvas.click({ button: "right", position: { x: 400, y: 300 } });

    // Click Add Node...
    await page.getByRole("button", { name: "Add Node..." }).click();

    // Command palette should open — check the visible inner container
    // (cmdk dialog element is a positioning wrapper that Playwright may not
    // consider "visible")
    const paletteInput = page.locator("[cmdk-input]");
    await expect(paletteInput).toBeVisible();
  });

  test("Add Node → select type creates a node", async ({ page }) => {
    await page.goto("/");

    // Right-click → Add Node → select Database
    const canvas = page.locator(".react-flow");
    await canvas.click({ button: "right", position: { x: 400, y: 300 } });
    await page.getByRole("button", { name: "Add Node..." }).click();
    await page
      .getByRole("option", { name: /Database data\/database/ })
      .click();

    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });

  test("Fit View resets the viewport", async ({ page }) => {
    await page.goto("/");

    const canvas = page.locator(".react-flow");
    await canvas.click({ button: "right", position: { x: 400, y: 300 } });

    // Scope to the context menu to avoid matching ReactFlow's Fit View control
    const contextMenu = page.locator(".fixed.z-50.bg-popover");
    await contextMenu.getByRole("button", { name: "Fit View" }).click();

    // Context menu should close
    await expect(contextMenu).not.toBeVisible();
  });

  test("Auto Layout dispatches event without error", async ({ page }) => {
    await page.goto("/");

    // Add a node so auto-layout has something to work with
    await page.keyboard.press("Meta+k");
    await page
      .getByRole("option", { name: /Service compute\/service/ })
      .click();
    await page.waitForTimeout(200);

    // Right-click an empty area of the canvas (away from the node at 0,0)
    const canvas = page.locator(".react-flow");
    await canvas.click({ button: "right", position: { x: 200, y: 600 } });

    // Use the context menu's specific selector (bg-popover distinguishes from other fixed elements)
    const contextMenu = page.locator(".fixed.z-50.bg-popover");
    await contextMenu.getByRole("button", { name: "Auto Layout" }).click();

    // Context menu should close, no crash
    await expect(contextMenu).not.toBeVisible();

    // Node should still exist
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// Fix 10: Nodes placed at staggered positions (not all at 0,0)
// ---------------------------------------------------------------------------

test.describe("node positioning", () => {
  test("multiple nodes are placed at different positions", async ({ page }) => {
    await page.goto("/");

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

    // Both nodes should exist
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(2);

    // Get positions via transform attribute
    const positions = await nodes.evaluateAll((els) =>
      els.map((el) => {
        const style = (el as HTMLElement).style;
        // ReactFlow uses transform: translate(Xpx, Ypx) for positioning
        const match = style.transform?.match(
          /translate\((-?\d+\.?\d*)px,\s*(-?\d+\.?\d*)px\)/,
        );
        return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : null;
      }),
    );

    // Both should have positions, and they should differ
    expect(positions[0]).not.toBeNull();
    expect(positions[1]).not.toBeNull();
    if (positions[0] && positions[1]) {
      const samePosition =
        positions[0].x === positions[1].x && positions[0].y === positions[1].y;
      expect(samePosition).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Batch undo — deleting multiple nodes undoes in a single Cmd+Z
// ---------------------------------------------------------------------------

test.describe("batch undo", () => {
  test("select-all + delete undoes with a single Cmd+Z", async ({ page }) => {
    await page.goto("/");

    // Add 3 nodes
    const nodeTypes = [
      /Service compute\/service/,
      /Database data\/database/,
      /Message Queue messaging\/message-queue/,
    ];
    for (const pattern of nodeTypes) {
      await page.keyboard.press("Meta+k");
      await page.getByRole("option", { name: pattern }).click();
      await page.waitForTimeout(200);
    }
    await expect(page.locator(".react-flow__node")).toHaveCount(3);

    // Select all (Cmd+A) and delete
    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(page.getByText(/0 nodes/)).toBeVisible();

    // Single undo should restore all 3 nodes
    await page.keyboard.press("Meta+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.getByText(/3 nodes/)).toBeVisible();
  });

  test("redo after batch undo re-deletes all nodes", async ({ page }) => {
    await page.goto("/");

    // Add 2 nodes
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

    // Select all, delete, undo, redo
    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);

    await page.keyboard.press("Meta+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);

    await page.keyboard.press("Meta+Shift+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Panel toggles (View menu)
// ---------------------------------------------------------------------------

test.describe("panel toggles", () => {
  test("Toggle Left Panel collapses and expands", async ({ page }) => {
    await page.goto("/");

    const leftPanel = page.locator('[data-slot="resizable-panel"]').first();

    // Get initial width
    const initialWidth = await leftPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(initialWidth).toBeGreaterThan(0);

    // Toggle to collapse
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Toggle Left Panel" }).click();
    await page.waitForTimeout(300);

    const collapsedWidth = await leftPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(collapsedWidth).toBe(0);

    // Toggle to expand
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Toggle Left Panel" }).click();
    await page.waitForTimeout(300);

    const expandedWidth = await leftPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(expandedWidth).toBeGreaterThan(0);
  });

  test("Toggle Right Panel collapses and expands", async ({ page }) => {
    await page.goto("/");

    const rightPanel = page.locator('[data-slot="resizable-panel"]').last();

    const initialWidth = await rightPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(initialWidth).toBeGreaterThan(0);

    // Toggle to collapse
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Toggle Right Panel" }).click();
    await page.waitForTimeout(300);

    const collapsedWidth = await rightPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(collapsedWidth).toBe(0);

    // Toggle to expand
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Toggle Right Panel" }).click();
    await page.waitForTimeout(300);

    const expandedWidth = await rightPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(expandedWidth).toBeGreaterThan(0);
  });
});
