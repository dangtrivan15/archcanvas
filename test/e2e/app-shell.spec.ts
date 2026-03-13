import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fix 1: CSS Theme Variables
// ---------------------------------------------------------------------------

test.describe("theme variables", () => {
  test("all required CSS color variables are defined", async ({ page }) => {
    await page.goto("/");

    const vars = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const required = [
        "--color-background",
        "--color-foreground",
        "--color-muted",
        "--color-muted-foreground",
        "--color-border",
        "--color-input",
        "--color-popover",
        "--color-popover-foreground",
        "--color-card",
        "--color-card-foreground",
        "--color-accent",
        "--color-accent-foreground",
      ];
      const result: Record<string, string> = {};
      for (const v of required) {
        result[v] = style.getPropertyValue(v).trim();
      }
      return result;
    });

    for (const [name, value] of Object.entries(vars)) {
      expect(value, `${name} should be defined`).not.toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// Fix 1 + 2: Menubar dropdowns render with opaque background
// ---------------------------------------------------------------------------

test.describe("menubar", () => {
  test("File menu opens with opaque popover background", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("menuitem", { name: "File" }).click();
    const content = page.locator('[data-slot="menubar-content"]');
    await expect(content).toBeVisible();

    const bg = await content.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // Should not be transparent (rgba(0,0,0,0)) or white
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toContain("255, 255, 255");

    // Menu items should be present
    await expect(
      page.getByRole("menuitem", { name: /New Project/ }),
    ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^Save ⌘S$/ })).toBeVisible();
  });

  test("Edit menu opens with Undo/Redo items", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("menuitem", { name: "Edit" }).click();
    const content = page.locator('[data-slot="menubar-content"]');
    await expect(content).toBeVisible();

    await expect(
      page.getByRole("menuitem", { name: /Undo/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /Redo/ }),
    ).toBeVisible();
  });

  test("View menu opens with panel toggles and actions", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("menuitem", { name: "View" }).click();
    const content = page.locator('[data-slot="menubar-content"]');
    await expect(content).toBeVisible();

    await expect(
      page.getByRole("menuitem", { name: /Toggle Left Panel/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /Command Palette/ }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Fix 2: Command palette dark theme
// ---------------------------------------------------------------------------

test.describe("command palette", () => {
  test("opens with dark popover background on Cmd+K", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Meta+k");

    // cmdk renders the dialog element as a positioning wrapper — check the
    // visible inner container (the rounded-lg card) instead.
    const paletteBox = page.locator("[cmdk-root] .rounded-lg.bg-popover");
    await expect(paletteBox).toBeVisible();

    const bg = await paletteBox.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toContain("255, 255, 255");
  });

  test("shows Actions and Node Types sections", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Meta+k");

    await expect(
      page.getByRole("option", { name: /Undo/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /Service compute\/service/ }),
    ).toBeVisible();
  });

  test("closes on Escape", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Meta+k");
    const paletteInput = page.locator("[cmdk-input]");
    await expect(paletteInput).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(paletteInput).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Fix 2: Context menu dark theme
// ---------------------------------------------------------------------------

test.describe("context menu", () => {
  test("opens with dark background on canvas right-click", async ({
    page,
  }) => {
    await page.goto("/");

    const canvas = page.locator(".react-flow");
    await canvas.click({ button: "right", position: { x: 400, y: 300 } });

    const addNodeBtn = page.getByRole("button", { name: "Add Node..." });
    await expect(addNodeBtn).toBeVisible();

    // Check context menu container bg
    const menu = addNodeBtn.locator("..");
    const bg = await menu.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toContain("255, 255, 255");
  });

  test("has Add Node, Auto Layout, and Fit View items", async ({ page }) => {
    await page.goto("/");

    const canvas = page.locator(".react-flow");
    await canvas.click({ button: "right", position: { x: 400, y: 300 } });

    // Scope to our custom context menu (not ReactFlow's controls)
    const contextMenu = page.locator(".fixed.z-50.bg-popover");

    await expect(
      contextMenu.getByRole("button", { name: "Add Node..." }),
    ).toBeVisible();
    await expect(
      contextMenu.getByRole("button", { name: "Auto Layout" }),
    ).toBeVisible();
    await expect(
      contextMenu.getByRole("button", { name: "Fit View" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Fix 3: ReactFlow controls dark theme
// ---------------------------------------------------------------------------

test.describe("reactflow controls", () => {
  test("control buttons are visible with non-white background", async ({
    page,
  }) => {
    await page.goto("/");

    const zoomIn = page.getByRole("button", { name: "Zoom In" });
    await expect(zoomIn).toBeVisible();

    const bg = await zoomIn.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // Should not be the ReactFlow default near-white (#fefefe)
    expect(bg).not.toContain("254, 254, 254");
    expect(bg).not.toContain("255, 255, 255");
  });
});

// ---------------------------------------------------------------------------
// Fix 6: Panel sizing — panels use percentage-based sizes (not px)
// ---------------------------------------------------------------------------

test.describe("panel sizing", () => {
  test("left panel is wide enough to show toolbar icons", async ({ page }) => {
    await page.goto("/");

    const leftPanel = page.locator('[data-slot="resizable-panel"]').first();
    const width = await leftPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    // Must be at least 48px to fit 36px icon buttons + padding
    expect(width).toBeGreaterThanOrEqual(48);
  });

  test("right panel is wide enough to show detail text", async ({ page }) => {
    await page.goto("/");

    const rightPanel = page.locator('[data-slot="resizable-panel"]').last();
    const width = await rightPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    // Must be at least 180px to render "Detail Panel" heading without clipping
    expect(width).toBeGreaterThanOrEqual(180);

    // "Detail Panel" heading should render in full (not clipped)
    await expect(
      rightPanel.getByRole("heading", { name: "Detail Panel" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Fix 7: Resize handle visibility
// ---------------------------------------------------------------------------

test.describe("resize handles", () => {
  test("resize handles are visible between panels", async ({ page }) => {
    await page.goto("/");

    const handles = page.locator('[data-slot="resizable-handle"]');
    await expect(handles).toHaveCount(2);

    // Both handles should be visible
    await expect(handles.first()).toBeVisible();
    await expect(handles.last()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Fix 8: Accessibility — toolbar aria-labels
// ---------------------------------------------------------------------------

test.describe("toolbar accessibility", () => {
  test("left toolbar buttons have aria-labels", async ({ page }) => {
    await page.goto("/");

    const expectedLabels = [
      "Select (V)",
      "Pan (H)",
      "Add Node (N)",
      "Connect (C)",
      "Search (⌘K)",
      "Auto Layout (⌘⇧L)",
      "Undo (⌘Z)",
      "Redo (⇧⌘Z)",
      "AI Chat (⌘⇧I)",
    ];

    for (const label of expectedLabels) {
      await expect(
        page.getByRole("button", { name: label }),
      ).toBeVisible();
    }
  });
});
