# Task 1: Merge New/Open into "Open..." + UI Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Merge "New Project" and "Open Project" into a single "Open..." action across all UI surfaces
**Parent feature:** [./2026-03-24-menubar-ux-index.md](./2026-03-24-menubar-ux-index.md)

## Write Set

- Modify: `src-web/store/fileStore.ts` (~30 lines) — remove `newProject()`, keep `open()` as the single entry point, simplify the `window.open` URL param to just `?action=open`
- Modify: `src-web/components/layout/TopMenubar.tsx` (~10 lines) — replace "New Project" + "Open..." items with single "Open..." item under File menu
- Modify: `src-web/components/shared/CommandPalette.tsx` (~5 lines) — merge `action:new-project` and `action:open` into single "Open..." action
- Modify: `src-web/components/layout/ProjectGate.tsx` (~20 lines) — replace two buttons with single "Open..." button, remove `?action=new` URL param handling, update subtitle text
- Modify: `src-web/components/hooks/useAppKeyboard.ts` (~5 lines) — keep ⌘O → `open()`, no ⌘N needed

Test files (unlimited):
- Modify: `test/store/fileStore-newProject.test.ts` — rename to `fileStore-open.test.ts`, update to test `open()` only
- Modify: `test/components/ProjectGate.test.tsx` — update for single button
- Modify: `test/unit/components/shared/CommandPalette.test.tsx` — remove "New Project" action test
- Modify: E2E tests referencing "New Project" (`test/e2e/file-operations.spec.ts`, `test/e2e/app-shell.spec.ts`, `test/e2e/e2e-helpers.ts`)

## Read Set (context needed)

- `src-web/store/fileStore.ts` — current `newProject()` and `open()` implementations (lines 353-394)
- `src-web/components/layout/TopMenubar.tsx` — current menu structure
- `src-web/components/layout/ProjectGate.tsx` — current dual-button layout + URL param logic
- `src-web/components/shared/CommandPalette.tsx` — current file actions (lines 129-133)
- `src-web/components/hooks/useAppKeyboard.ts` — keyboard handler
- `test/store/fileStore-newProject.test.ts` — existing test coverage

## Dependencies

- **Blocked by:** None (first task)
- **Blocks:** Task 2 (Open Recent), Task 3 (Tauri multi-window)

## Description

The current codebase has two separate menu actions — "New Project" and "Open Project" — that are **functionally identical** on web. Both call `window.open()` to open a new tab, then the new tab shows a directory picker. The system auto-detects whether the chosen directory is a new or existing project by checking for `.archcanvas/main.yaml`.

This task merges them into a single **"Open..."** action. The merge is clean because:
1. `newProject()` and `open()` in fileStore do the same thing
2. `ProjectGate` handles `?action=new` and `?action=open` identically
3. The onboarding wizard already handles the "new project" case when a directory lacks `.archcanvas/`

### Changes by surface:

**File menu (TopMenubar):** Remove "New Project ⌘N", keep "Open... ⌘O" as the only open action. "Open Recent" and "Save" remain unchanged.

**Command Palette:** Remove `action:new-project`, keep `action:open` renamed to "Open..." with ⌘O shortcut.

**ProjectGate (landing screen):** Replace two buttons with a single prominent "Open..." button. Update subtitle from "Open an existing project or create a new one" to "Open a project folder to get started." The single button calls `open()`.

**fileStore:** Delete `newProject()` entirely. The `open()` method's behavior stays the same — if `fs !== null`, open new tab with `?action=open`; otherwise, show picker.

**ProjectGate URL params:** Only handle `?action=open` (remove `?action=new` branch). Both previously did the same thing.

**Keyboard:** ⌘O already calls `open()`. ⌘N was displayed in the menubar but **never wired** in `useAppKeyboard.ts` — removing the display is the only change.

### Acceptance criteria:
- Single "Open..." item in File menu with ⌘O shortcut
- Single "Open..." action in Command Palette
- Single "Open..." button on ProjectGate landing screen
- `newProject()` removed from fileStore interface
- `?action=new` URL param no longer handled (only `?action=open`)
- All existing tests pass (updated for new naming)
- No behavioral regression — opening projects, onboarding, and save all work as before
