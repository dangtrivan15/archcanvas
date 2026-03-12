# 06: UI Bugs & Polish

> **Date**: 2026-03-13 | **Status**: Complete
> **Scope**: Fix 12+ bugs/UX issues found during Playwright-driven UI audit of I2 canvas rendering

## Recap

After completing I2 (Canvas Rendering), we ran a systematic Playwright MCP-driven probe of the app — navigating every menu, adding nodes, dragging, deleting, opening the command palette with each prefix, collapsing panels, and inspecting console output. This surfaced 7 bugs, 2 console error categories, and 7 UX improvements.

We created a 14-task implementation plan ([`docs/plans/2026-03-13-ui-bugs-and-polish.md`](../plans/2026-03-13-ui-bugs-and-polish.md)) grouping fixes to minimize file conflicts, then dispatched 6 parallel agents in isolated git worktrees. After merging all worktree branches, we manually applied fixes that agents missed, resolved 3 merge conflicts, and fixed a test regression. A batch code review against the design spec and progress docs confirmed architectural compliance.

**What was fixed (committed):**

| ID | Issue | Fix |
|----|-------|-----|
| B1 | Context menu Delete deleted wrong node | `ContextMenu` now passes `nodeId` through; `handleNodeDelete` selects then deletes |
| B3 | Toolbar buttons all opened command palette | New `toolStore` (select/pan/connect); `LeftToolbar` wired to `setMode()` |
| B4 | Icon names rendered as text ("MessageSquare") | New `iconMap.ts` maps all 32 builtin icon strings → Lucide components |
| B5 | Status bar "1 nodes" grammar | Singular/plural conditional in `StatusBar.tsx` |
| B6 | Missing favicon → 404 | Added `public/favicon.svg` + `<link>` in `index.html` |
| C1 | Radix DialogTitle a11y warning | `VisuallyHidden` heading + description in `CommandPalette` |
| U1 | Right-click didn't select node | `onNodeContextMenu` now calls `selectNodes([node.id])` |
| U3 | Fit-view too tight after auto-layout | Added `padding: 0.15` to `fitView` call |
| U5 | New nodes all named by type key | `NodeTypeProvider.onSelect` resolves `displayName`, deduplicates ("Service", "Service 2") |
| U6 | `__root__` shown raw in scope palette | `ScopeProvider` maps to "Root" / "Root scope" |

**What was fixed (uncommitted, pending push):**

| ID | Issue | Fix |
|----|-------|-----|
| B2 | Drag teleport (node jumps to final position) | Local `rfNodes` state + `applyNodeChanges` for smooth controlled-mode drag |
| — | Add Node button ignored `@` prefix | Event listener reads `detail.prefix`, passes `initialInput` to `CommandPalette` |
| — | No panning in select mode | `panOnDrag={[1, 2]}` enables middle/right-click panning in select mode |

**What remains (not started):**
- Task 14: Comprehensive E2E tests for all fixed flows (`test/e2e/ui-polish.spec.ts`)
- Task U4: Menu click deselects node (needs investigation — may require Radix menu `onOpenChange` coordination)

**Files changed:** 12 committed + 3 uncommitted across `src/components/`, `src/store/`, `public/`, `test/`, `index.html`

**New files:** `src/store/toolStore.ts`, `src/components/nodes/iconMap.ts`, `public/favicon.svg`, `test/setup/playwrightSlotGuard.ts`

## Decisions

### ReactFlow Controlled Mode

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Drag smoothness | Local `rfNodes` state + `applyNodeChanges` synced from store via `useEffect` | Uncontrolled mode (`defaultNodes`) | Uncontrolled mode loses reactivity to store changes (undo, auto-layout, external mutations). Local state layer preserves both smooth drag AND store-driven updates |
| Pan in select mode | `panOnDrag={[1, 2]}` (middle + right mouse) | `panOnDrag={false}` (pan-mode only) | Most canvas tools allow panning via middle-click regardless of active tool. Strict pan-mode-only felt too rigid for daily use |

### Parallel Agent Strategy

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Agent execution | 6 worktree-isolated agents, merged into integration branch | Sequential execution in single branch | Tasks were independent with minimal file overlap. Parallel cut wall-clock time significantly |
| Code review | Single batch review after merge | Per-agent review loop | Merge-first-then-review caught cross-cutting issues (like the test mock regression) that per-agent review would miss. Also fewer review cycles |

### Icon Resolution

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Icon mapping | Static `iconMap.ts` with explicit string→component map | Dynamic `lucide-react` import by name | Static map is tree-shakeable, type-safe, and doesn't require runtime string matching. The 32 builtin icons are a known set |

## Retrospective

- **What went well** — The Playwright MCP probe was highly effective at surfacing real bugs a manual code review would miss. The parallel worktree agents finished all 6 branches in roughly the time one would take. The batch code review caught the `@` prefix wiring gap that individual agents missed.

- **What didn't** — 2 of 6 agents completed their work but failed to commit, requiring manual application of their diffs. Merge conflicts in `LeftToolbar.tsx`, `CommandPalette.tsx`, and `playwrightSlotGuard.ts` needed manual resolution. The drag teleport fix required two iterations: the first fix (gating engine commits to drag-end) was necessary but insufficient — the root cause was ReactFlow's controlled-mode contract requiring `applyNodeChanges` for ALL changes.

- **Lessons**
  - ReactFlow controlled mode: if you pass `nodes` as a prop, you own ALL position updates — including mid-drag. Ignoring changes means the node visually freezes. This is a fundamental contract, not optional.
  - When dispatching parallel agents, explicitly instruct them to commit before completing. "Implement X" doesn't imply "commit X" to an agent.
  - Batch review after merge is superior to per-agent review for catching integration issues, but per-agent review would catch agent-local quality issues earlier. A hybrid (lightweight per-agent + thorough batch) may be ideal.

- **Notes for future**
  - E2E test coverage (Task 14) should be written before merging to main — the fixes are verified manually but not regression-protected yet
  - U4 (menu deselect) likely needs Radix `DropdownMenu`'s `onOpenChange` to suppress the pane-click deselection while a menu is open
  - The `@radix-ui/react-visually-hidden` import relies on a transitive dependency — consider adding it explicitly to `package.json`
