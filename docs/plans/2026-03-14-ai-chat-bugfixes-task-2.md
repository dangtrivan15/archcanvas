# Task 2: Global Project Gate

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Global project-open enforcement at the App UI level
**Parent feature:** [AI Chat Bugfixes Index](./2026-03-14-ai-chat-bugfixes-index.md)

## Write Set

- Create: `src/components/layout/ProjectGate.tsx` (~80 lines)
- Modify: `src/store/fileStore.ts` (~40 lines — add `newProject()` method)
- Modify: `src/App.tsx` (~15 lines — wrap with gate, remove `initializeEmptyProject()` bootstrap)

Tests:
- Create: `test/components/ProjectGate.test.ts`
- Create: `test/store/fileStore-newProject.test.ts`
- Possibly modify: `test/e2e/*.spec.ts` (if E2E tests assume immediate canvas)

## Read Set (context needed)

- `src/store/fileStore.ts` — current state, `open()`, `openProject()`, `initializeEmptyProject()` methods
- `src/platform/filePicker.ts` — `FilePicker` interface, `createFilePicker()`
- `src/platform/fileSystem.ts` — `FileSystem` interface (mkdir, writeFile, exists)
- `src/cli/commands/init.ts` — scaffold template (reference for `newProject()` YAML template)
- `src/components/hooks/useAppKeyboard.ts` — Cmd+O shortcut (will still work through gate)
- `src/components/hooks/useAiProvider.ts` — AI provider bootstrap (stays outside gate)
- `src/App.tsx` — current structure, `initializeEmptyProject()` call location
- `src/core/ai/webSocketProvider.ts` — `NO_FILESYSTEM` error at line 248 (kept as defense-in-depth)

## Dependencies

- **Blocked by:** None
- **Blocks:** None (I6b builds on top of this gate)

## Description

### Problem

When the app starts, `App.tsx` calls `initializeEmptyProject()` which creates an in-memory project with `fileStore.fs = null`. This means:
- The AI bridge fails with `NO_FILESYSTEM` when relaying mutations (Bug 3)
- The app has a project-like state but no filesystem backing — a confusing hybrid
- The CLI's bridge path assumes the browser can persist, but it can't

### Solution: Project Gate

Replace the `initializeEmptyProject()` bootstrap with a `<ProjectGate>` component that enforces opening a real project before the app is usable.

### Part A: `newProject()` Method in fileStore

Add a `newProject()` method to fileStore that mirrors the CLI `init` command:

```typescript
newProject: async () => {
  const picker = getFilePicker();
  const fs = await picker.pickDirectory();
  if (!fs) return; // user cancelled

  // If .archcanvas/main.yaml already exists, treat as "open existing"
  if (await fs.exists('.archcanvas/main.yaml')) {
    await get().openProject(fs);
  } else {
    // Scaffold new project
    await fs.mkdir('.archcanvas');
    const template = `project:\n  name: "New Project"\n  description: ""\n  version: "1.0.0"\n\nnodes: []\nedges: []\nentities: []\n`;
    await fs.writeFile('.archcanvas/main.yaml', template);
    await get().openProject(fs);
  }

  if (get().status === 'loaded') {
    const projectName = get().project?.root.data.project?.name ?? 'Unknown';
    const path = projectName;
    set({
      fs,
      recentProjects: addToRecent(get().recentProjects, projectName, path),
    });
  }
}
```

**Key decisions:**
- If user picks a directory that already has `.archcanvas/main.yaml`, just open it (don't error like CLI `init` does). The gate's "New Project" button is about getting to a working state, not strictly creating a new project.
- Use a generic name "New Project" in the template. I6b will add a wizard step to collect the real name.
- The `fs.mkdir('.archcanvas')` call should be idempotent (create if not exists). Check if the FileSystem implementations handle this — if not, guard with `exists()` check.

### Part B: `ProjectGate` Component

A full-screen component that replaces the main app content when no project is open.

**Render condition:** `fileStore.fs === null`

**Layout:**
```
┌──────────────────────────────────────────────────┐
│                                                  │
│                                                  │
│               ArchCanvas                         │
│          Architecture as Code                    │
│                                                  │
│   ┌─────────────────┐  ┌─────────────────┐      │
│   │  Open Project    │  │  New Project     │      │
│   │  (Cmd+O)         │  │                  │      │
│   └─────────────────┘  └─────────────────┘      │
│                                                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Implementation details:**
- Two buttons: "Open Project" (calls `fileStore.open()`) and "New Project" (calls `fileStore.newProject()`)
- Show Cmd+O hint on the Open button (existing keyboard shortcut still works)
- Use existing Tailwind dark theme classes for consistency
- No recent projects list for now (I6b can add this)
- Show error state if `fileStore.status === 'error'` (e.g., invalid project directory)
- The component should be a sibling to `useAppKeyboard()` and `useAiProvider()` — these hooks stay active even when the gate is showing, so Cmd+O works globally

**Component structure in App.tsx:**
```tsx
export function App() {
  // ... existing hooks (useAppKeyboard, useAiProvider, registryStore.initialize) ...
  const fs = useFileStore(s => s.fs);

  if (!fs) {
    return <ProjectGate />;
  }

  return (
    // ... existing app layout (TooltipProvider, ReactFlowProvider, panels, etc.) ...
  );
}
```

The gate is rendered at the App level — it's a complete replacement, not an overlay. This means the canvas, panels, toolbars, and status bar don't render at all until a project is open.

### Part C: App.tsx Changes

1. **Remove** the `initializeEmptyProject()` call in the `useEffect` (lines 63-70)
2. **Add** the `fs` check and conditional rendering
3. **Keep** `registryStore.initialize()` — it loads builtins, which are needed regardless
4. **Keep** `useAppKeyboard()` — Cmd+O should work on the gate screen
5. **Keep** `useAiProvider()` — WebSocket connection can be established early
6. **Remove** or simplify the document title effect — when no project is open, title is just "ArchCanvas"

### Part D: Defense-in-Depth

The `NO_FILESYSTEM` error in `webSocketProvider.ts` (line 248) is **kept unchanged**. With the gate, this path should never trigger in normal operation. If it does, it indicates a bug (race condition, state corruption), and the error message is appropriate. No changes needed.

### E2E Test Impact

E2E tests currently rely on the app starting with an empty canvas (via `initializeEmptyProject()`). With the gate, they'll see the landing screen first. Options:
1. **Add a project-open step** to E2E test setup (preferred — matches real user flow)
2. **Create a test project directory** in the Playwright `globalSetup` and navigate to it
3. **Check existing E2E setup** in `test/e2e/` and `test/setup/` for how projects are bootstrapped

The preferred approach: create a fixture project in `test/setup/` that E2E tests open at the start. This also makes E2E tests more realistic.

### Acceptance Criteria

- App shows ProjectGate on first launch (no project open)
- "Open Project" button opens directory picker and loads existing `.archcanvas/` project
- "New Project" button opens directory picker, scaffolds `.archcanvas/main.yaml`, and loads project
- After opening a project, full app UI renders (canvas, panels, toolbars)
- Cmd+O keyboard shortcut works on the gate screen
- If user cancels the directory picker, gate remains visible
- `fileStore.fs` is always non-null when the app content renders
- Existing unit tests pass (they don't depend on `initializeEmptyProject()` being called in App)
- AI chat bridge no longer hits `NO_FILESYSTEM` in normal operation
