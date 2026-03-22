/**
 * Demo recording: "Onboard with AI" flow.
 *
 * This script automates the full onboarding wizard → AI analysis → architecture
 * diagram flow, producing a video recording via Playwright's built-in recorder.
 *
 * Prerequisites:
 *   - `npm run dev` running (port 5173)
 *   - Claude Code connected (WebSocket bridge available)
 *
 * Run:
 *   npx playwright test --config playwright.config.demo.ts
 *
 * The video is saved to demo-videos/.
 */

import { test, expect } from "@playwright/test";

const PROJECT_PATH =
  process.env.DEMO_PROJECT_PATH || process.cwd();

// How long to wait for AI streaming to finish (default 5 min)
const AI_TIMEOUT = Number(process.env.DEMO_TIMEOUT) || 300_000;

test("onboard with AI — demo recording", async ({ page }) => {
  // -----------------------------------------------------------------------
  // 1. Navigate to the app
  // -----------------------------------------------------------------------
  await page.goto("/");
  await page.waitForTimeout(500);

  // -----------------------------------------------------------------------
  // 2. Set up needs_onboarding state with a working in-memory FileSystem
  //    and pre-set the projectPath so the AI knows where to look.
  // -----------------------------------------------------------------------
  await page.evaluate((projectPath) => {
    const files: Record<string, string> = {};
    const dirs = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__archcanvas_fileStore__;
    if (!store) throw new Error("fileStore not exposed on window");

    store.setState({
      fs: {
        getName: () => "archcanvas",
        getPath: () => projectPath,
        readFile: async (path: string) => files[path] ?? "",
        writeFile: async (path: string, content: string) => {
          files[path] = content;
        },
        exists: async (path: string) =>
          path in files || dirs.has(path),
        mkdir: async (path: string) => {
          dirs.add(path);
        },
        listFiles: async () => [],
        listEntries: async () => [],
        listFilesRecursive: async () => [],
        deleteFile: async () => {},
      },
      status: "needs_onboarding",
      project: null,
      error: null,
      projectPath,
    });
  }, PROJECT_PATH);

  // Wait for React to render the wizard
  await page.waitForTimeout(500);

  // -----------------------------------------------------------------------
  // 3. Wizard Step 1: Click "AI Analyze"
  // -----------------------------------------------------------------------
  await expect(page.getByText("Welcome to ArchCanvas")).toBeVisible();
  await page.waitForTimeout(800); // Let the user see the welcome screen

  const aiAnalyzeBtn = page.getByText("AI Analyze");
  await expect(aiAnalyzeBtn).toBeVisible();
  await aiAnalyzeBtn.click();

  // -----------------------------------------------------------------------
  // 4. Wizard Step 2: Fill the survey form
  // -----------------------------------------------------------------------
  await expect(page.getByText("Configure AI Analysis")).toBeVisible();
  await page.waitForTimeout(500);

  // 4a. Wait for Claude Code provider to show as connected
  //     The provider radio buttons are in a radiogroup with aria-label "AI provider"
  const providerGroup = page.getByRole("radiogroup", {
    name: "AI provider",
  });
  await expect(providerGroup).toBeVisible({ timeout: 5000 });

  // Click the Claude Code provider radio if not already active
  const claudeCodeRadio = providerGroup.getByRole("radio", {
    name: /Claude Code/,
  });
  if (await claudeCodeRadio.isVisible()) {
    await claudeCodeRadio.click();
  }

  // Wait for the green dot (connected indicator) — the radio button
  // contains a span with bg-green-500 when the provider is available
  await expect(
    claudeCodeRadio.locator("span.bg-green-500"),
  ).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(300);

  // 4b. Project path — should be pre-filled from our evaluate setup.
  //     Click "Set" to confirm it.
  const projectPathInput = page.locator("#project-path-input");
  if (await projectPathInput.isVisible()) {
    // Clear and re-type for visual effect in the recording
    await projectPathInput.clear();
    await projectPathInput.pressSequentially(PROJECT_PATH, { delay: 30 });
    await page.waitForTimeout(200);

    const setBtn = page.getByRole("button", { name: "Set" });
    if (await setBtn.isVisible()) {
      await setBtn.click();
    }
  }
  await page.waitForTimeout(300);

  // 4c. Fill description
  const descriptionField = page.getByPlaceholder(
    /Describe what this project does/i,
  );
  await descriptionField.click();
  await descriptionField.pressSequentially(
    "A web-based architecture diagramming tool with AI-powered codebase analysis. Built with React, ReactFlow, Zustand, and Claude Code SDK. Keep the diagram compact and dense — prefer fewer top-level nodes with subsystems over many flat nodes. Group related modules into subsystems.",
    { delay: 20 },
  );
  await page.waitForTimeout(300);

  // 4d. Select TypeScript in tech stack
  const tsLabel = page.locator("label").filter({ hasText: "TypeScript" });
  await tsLabel.click();
  await page.waitForTimeout(200);

  // 4e. Exploration depth — leave as "Full" (default)

  // 4f. Focus directories — fill in src/
  const focusDirsInput = page.locator("#focus-dirs");
  await focusDirsInput.click();
  await focusDirsInput.pressSequentially("src/", { delay: 40 });
  await page.waitForTimeout(300);

  // -----------------------------------------------------------------------
  // 5. Click "Start" — this triggers completeOnboarding('ai', survey)
  // -----------------------------------------------------------------------
  const startBtn = page.getByRole("button", { name: "Start" });
  await expect(startBtn).toBeEnabled();
  await page.waitForTimeout(500); // Pause before the big moment
  await startBtn.click();

  // -----------------------------------------------------------------------
  // 6. Wait for the canvas + chat panel to appear
  // -----------------------------------------------------------------------
  // The canvas should render (wizard dismissed, project loaded)
  await expect(page.locator(".react-flow")).toBeVisible({
    timeout: 10_000,
  });

  // Chat panel should open automatically
  await expect(
    page.getByRole("heading", { name: "AI Chat" }),
  ).toBeVisible({ timeout: 5_000 });

  // -----------------------------------------------------------------------
  // 7. Wait for AI streaming to complete
  //    During streaming, a "Stop" button is shown. When done, it swaps to
  //    "Send message". We also wait for at least one node to appear first.
  // -----------------------------------------------------------------------

  // Wait for at least one node to appear (AI has started creating)
  await expect(page.locator(".react-flow__node").first()).toBeVisible({
    timeout: AI_TIMEOUT,
  });

  // Wait for streaming to end — the "Send message" button reappears
  // when isStreaming becomes false (replaces the "Stop" button).
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeVisible({ timeout: AI_TIMEOUT });

  // Give auto-layout a moment to fire (triggered by the streaming-end subscriber)
  await page.waitForTimeout(2_000);

  // -----------------------------------------------------------------------
  // 8. Final showcase — pause on the completed diagram
  // -----------------------------------------------------------------------

  // Count what the AI built
  const nodeCount = await page.locator(".react-flow__node").count();
  const edgeCount = await page.locator(".react-flow__edge").count();
  console.log(
    `\n✓ Demo complete: ${nodeCount} nodes, ${edgeCount} edges on canvas\n`,
  );

  // Hold the final frame for 5 seconds so the viewer can absorb the result
  await page.waitForTimeout(5_000);
});
