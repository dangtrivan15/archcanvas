import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// 1. Chat panel toggle
// ---------------------------------------------------------------------------

test.describe("chat panel toggle", () => {
  test("AI Chat button exists in left toolbar", async ({ page }) => {
    await page.goto("/");

    const chatButton = page.getByRole("button", { name: "AI Chat (⌘⇧I)" });
    await expect(chatButton).toBeVisible();
  });

  test("clicking AI Chat button opens chat panel", async ({ page }) => {
    await page.goto("/");

    // Click AI Chat button
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();

    // Chat panel header should appear
    const chatHeader = page.getByText("AI Chat", { exact: true }).first();
    await expect(chatHeader).toBeVisible();
  });

  test("clicking AI Chat button again returns to details mode", async ({
    page,
  }) => {
    await page.goto("/");

    const chatButton = page.getByRole("button", { name: "AI Chat (⌘⇧I)" });

    // Open chat
    await chatButton.click();
    await expect(
      page.getByText("AI Chat", { exact: true }).first(),
    ).toBeVisible();

    // Close chat — click again
    await chatButton.click();

    // Should return to detail panel mode
    await expect(
      page.getByRole("heading", { name: "Detail Panel" }),
    ).toBeVisible();
  });

  test("Cmd+Shift+I opens chat panel", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Meta+Shift+i");

    // Chat panel header should appear
    const chatHeader = page.getByText("AI Chat", { exact: true }).first();
    await expect(chatHeader).toBeVisible();
  });

  test("Cmd+Shift+I again closes chat panel", async ({ page }) => {
    await page.goto("/");

    // Open
    await page.keyboard.press("Meta+Shift+i");
    await expect(
      page.getByText("AI Chat", { exact: true }).first(),
    ).toBeVisible();

    // Close
    await page.keyboard.press("Meta+Shift+i");

    // Should return to detail panel
    await expect(
      page.getByRole("heading", { name: "Detail Panel" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Chat panel layout
// ---------------------------------------------------------------------------

test.describe("chat panel layout", () => {
  test("chat panel shows header with AI Chat text", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();

    // Verify the "AI Chat" heading is visible
    const chatHeader = page.getByText("AI Chat", { exact: true }).first();
    await expect(chatHeader).toBeVisible();
  });

  test("chat panel shows provider selector", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();

    // In production build (vite preview), no WebSocket provider is registered.
    // The ChatProviderSelector renders "No providers" when the provider list
    // is empty.
    await expect(page.getByText("No providers")).toBeVisible();
  });

  test("chat panel has input textarea", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();

    const textarea = page.getByLabel("Chat input");
    await expect(textarea).toBeVisible();
  });

  test("chat panel has send button", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();

    const sendButton = page.getByRole("button", { name: "Send message" });
    await expect(sendButton).toBeVisible();
  });

  test("chat panel has close button", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();

    const closeButton = page.getByRole("button", { name: "Close chat" });
    await expect(closeButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Chat toggle + node selection interaction
// ---------------------------------------------------------------------------

test.describe("chat toggle and node selection interaction", () => {
  test("closing chat returns to details, then node selection shows NodeDetailPanel", async ({
    page,
  }) => {
    await page.goto("/");

    // Open chat panel
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();
    await expect(
      page.getByText("AI Chat", { exact: true }).first(),
    ).toBeVisible();

    // Close chat panel
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();
    await expect(
      page.getByRole("heading", { name: "Detail Panel" }),
    ).toBeVisible();

    // Add a node via command palette
    await page.keyboard.press("Meta+k");
    await page
      .getByRole("option", { name: /Service compute\/service/ })
      .click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Click the node to select it
    await page.locator(".react-flow__node").first().click();

    // NodeDetailPanel should appear (not the generic Detail Panel heading)
    // The NodeDetailPanel renders the node's displayName or id
    const rightPanel = page.locator('[data-slot="resizable-panel"]').last();
    await expect(
      rightPanel.getByRole("heading", { name: "Detail Panel" }),
    ).not.toBeVisible();
  });

  test("opening chat while node is selected replaces detail panel", async ({
    page,
  }) => {
    await page.goto("/");

    // Add and select a node
    await page.keyboard.press("Meta+k");
    await page
      .getByRole("option", { name: /Service compute\/service/ })
      .click();
    await page.waitForTimeout(200);
    await page.locator(".react-flow__node").first().click();

    // Open chat — should replace node details with chat
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();
    await expect(
      page.getByText("AI Chat", { exact: true }).first(),
    ).toBeVisible();

    // Close chat — node detail panel should return
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();

    // The generic "Detail Panel" heading should NOT be visible because a
    // node is still selected — NodeDetailPanel should render instead
    const rightPanel = page.locator('[data-slot="resizable-panel"]').last();
    await expect(
      rightPanel.getByRole("heading", { name: "Detail Panel" }),
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Panel collapse interaction
// ---------------------------------------------------------------------------

test.describe("panel collapse interaction", () => {
  test("clicking AI Chat when right panel is collapsed expands it and shows chat", async ({
    page,
  }) => {
    await page.goto("/");

    // Collapse the right panel via the View menu
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Toggle Right Panel" }).click();
    await page.waitForTimeout(300);

    const rightPanel = page.locator('[data-slot="resizable-panel"]').last();
    const collapsedWidth = await rightPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(collapsedWidth).toBe(0);

    // Click AI Chat — should expand right panel AND show chat
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();
    await page.waitForTimeout(300);

    // Panel should be expanded
    const expandedWidth = await rightPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(expandedWidth).toBeGreaterThan(0);

    // Chat panel should be visible
    await expect(
      page.getByText("AI Chat", { exact: true }).first(),
    ).toBeVisible();
  });

  test("closing chat after collapse-open shows details mode and remains expanded", async ({
    page,
  }) => {
    await page.goto("/");

    // Collapse right panel
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitem", { name: "Toggle Right Panel" }).click();
    await page.waitForTimeout(300);

    // Open chat (also expands)
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();
    await page.waitForTimeout(300);

    // Close chat
    await page.getByRole("button", { name: "AI Chat (⌘⇧I)" }).click();
    await page.waitForTimeout(300);

    // Panel should remain expanded
    const rightPanel = page.locator('[data-slot="resizable-panel"]').last();
    const width = await rightPanel.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(width).toBeGreaterThan(0);

    // Should show details mode
    await expect(
      page.getByRole("heading", { name: "Detail Panel" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. Chat button visual state
// ---------------------------------------------------------------------------

test.describe("chat button visual state", () => {
  test("AI Chat button is in default state when chat is closed", async ({
    page,
  }) => {
    await page.goto("/");

    const chatButton = page.getByRole("button", { name: "AI Chat (⌘⇧I)" });

    // Default state: text-muted-foreground, no bg-accent
    const className = await chatButton.getAttribute("class");
    expect(className).toContain("text-muted-foreground");
    expect(className).not.toMatch(/\bbg-accent\b/);
  });

  test("AI Chat button has active state when chat is open", async ({
    page,
  }) => {
    await page.goto("/");

    const chatButton = page.getByRole("button", { name: "AI Chat (⌘⇧I)" });

    // Open chat
    await chatButton.click();

    // Active state: bg-accent, not text-muted-foreground
    const className = await chatButton.getAttribute("class");
    expect(className).toContain("bg-accent");
  });

  test("AI Chat button returns to default state after toggling off", async ({
    page,
  }) => {
    await page.goto("/");

    const chatButton = page.getByRole("button", { name: "AI Chat (⌘⇧I)" });

    // Open chat
    await chatButton.click();
    // Verify active
    let className = await chatButton.getAttribute("class");
    expect(className).toContain("bg-accent");

    // Close chat
    await chatButton.click();
    // Verify default
    className = await chatButton.getAttribute("class");
    expect(className).toContain("text-muted-foreground");
    expect(className).not.toMatch(/\bbg-accent\b/);
  });
});
