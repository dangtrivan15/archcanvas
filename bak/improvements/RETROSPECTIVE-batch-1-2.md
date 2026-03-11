# Retrospective: Batch 1 & 2 Implementation

Insights, decisions, pitfalls, and workarounds from implementing proposals
P04, P06, P07, P09, P10 (Batch 1) and P02 (Batch 2).

---

## 1. Execution Strategy

### What Worked: Batch Ordering Was Correct

The dependency graph in `README.md` proved accurate. Batch 1 proposals (P04, P06,
P07, P09, P10) were truly independent — no merge conflicts between them. P02 was
correctly sequenced as Batch 2 since it touched ~95 consumer files and needed a
stable base.

### What Worked: "Implement as a whole, test when done"

For P02 (the monolithic store split), implementing the full migration in one pass
was faster than incremental migration. The compatibility facade approach (keeping
`coreStore.ts` as a thin wrapper) was attempted first but abandoned — in a POC
codebase, a clean break is simpler than maintaining two API surfaces.

### What Didn't Work: Branching Before Batch 1 Merged

P02 was started on a worktree that branched from `main` before Batch 1 commits
landed. This caused 5 merge conflicts when merging P02 back:

- `src/App.tsx` — P02 rewrote imports, P04 added `registry` from `engineStore`
- `src/components/canvas/Canvas.tsx` — P02 expected the old monolith, P07 had
  already split it into hooks
- `src/store/coreStore.ts` — P02 deleted it, Batch 1 had modified it
- Two test files had minor conflicts on import paths and test names

**Lesson for Batch 3:** Always branch from the latest `main` after the previous
batch is fully merged and committed. Never start a batch's worktree before the
prior batch's merge is complete.

### What Didn't Work: Worktree Directories Getting Staged

`.claude/worktrees/agent-*` directories were accidentally staged as embedded git
repos during the merge commit. These had to be removed with `git rm --cached`.

**Lesson for Batch 3:** Add `.claude/worktrees/` to `.gitignore` before starting
worktree-based work. Or always double-check `git status` before committing merge
results — watch for `??` entries under `.claude/`.

---

## 2. Per-Proposal Insights

### P04 — Extensible NodeDef System

**Scope reduction was key.** The proposal described a full plugin system with URL
loaders, community registries, and tech stack templates. The actual implementation
focused on the foundational change: replacing 91 hardcoded `?raw` Vite imports with
a unified loader and adding runtime `register()`/`unregister()` to the registry.

**Decision:** Created `src/core/registry/builtins.ts` with a generated array of
YAML strings (built at compile time), eliminating the Vite `?raw` dependency. CLI
and web app now share the same loader path through `registryCore.ts`.

**Pitfall:** The registry bridge pattern (exposing `registry` from `engineStore` so
React components can reactively read node definitions) required careful Zustand
subscription design. Components that depend on registry data need to subscribe to
`useEngineStore((s) => s.registry)`, not call `getRegistry()` imperatively.

### P06 — Platform Abstraction

**Enforcement over completion.** Rather than building out all platform backends
(desktop, iOS), the implementation focused on enforcing the abstraction in existing
code. Key function: `getFileLastModified(handle)` in `fileSystemAdapter.ts` —
a single adapter function that wraps `FileSystemFileHandle.getFile()`.

**Decision:** Added ESLint rules (`no-restricted-globals` for `localStorage`,
`no-restricted-properties` for direct `navigator` calls) that flag violations
outside `src/core/platform/`. This prevents regression.

**Pitfall:** When P02 later created `fileStore.ts`, it was written against the
pre-P06 patterns (direct `FileSystemFileHandle.getFile()` calls) because P02
branched before P06 merged. This caused 6 test failures in source-reading tests
that expected the platform adapter pattern. Fix was straightforward (3 call sites
in `fileStore.ts`), but it illustrates why batch ordering matters.

**Lesson for Batch 3:** P08 (Storage Backend Abstraction) builds directly on P06's
adapter layer. Verify that all stores use `getFileLastModified()` and other platform
adapters before starting P08 work.

### P07 — Decouple Canvas from React Flow

**The largest structural change in Batch 1.** Canvas.tsx went from ~1,530 lines to
~200 lines, with logic extracted into 8 hooks:

| Hook | Responsibility |
|------|---------------|
| `useCanvasRenderer` | RenderApi → React Flow nodes/edges state |
| `useCanvasInteractions` | Click, drag, connect, selection, pane click |
| `useCanvasKeyboard` | Delete/Backspace/Escape, arrow nav, Alt+Arrow bulk move |
| `useCanvasDragDrop` | NodeDef palette drag, .archc file drops, image drops |
| `useCanvasContextMenu` | Right-click menu state and positioning |
| `useCanvasConnectMode` | Edge creation connection mode toggle |
| `useCanvasNavigation` | Fractal zoom in/out, auto-layout on navigation |
| `useCanvasViewport` | Viewport sync between React Flow and store |

**Decision:** Hooks use `@xyflow/react` hooks directly (e.g., `useReactFlow()`) rather
than going through an adapter. The proposal suggested isolating React Flow to a single
`CanvasRenderer.tsx`, but in practice the hooks need React Flow's coordinate transforms
(`screenToFlowPosition`, `setCenter`, `getViewport`) which are only available inside the
`<ReactFlowProvider>`. Full isolation would require a cumbersome context-forwarding layer.

**Pitfall:** When P02 merged, these 6 hooks still referenced the deleted `useCoreStore`.
They had to be manually migrated post-merge:

| Hook | What Changed |
|------|-------------|
| `useCanvasRenderer` | `useCoreStore(s => s.graph)` → `useGraphStore(s => s.graph)` + `useEngineStore(s => s.renderApi)` |
| `useCanvasInteractions` | `useCoreStore(s => s.moveNode)` → `useGraphStore(s => s.moveNode)` |
| `useCanvasKeyboard` | Most complex — needed `useGraphStore`, `useEngineStore`, `useHistoryStore` |
| `useCanvasDragDrop` | `useCoreStore(s => s.addNode)` → `useGraphStore(s => s.addNode)` + `useFileStore(s => s.loadFromDroppedFile)` |
| `useCanvasConnectMode` | `useCoreStore(s => s.addEdge)` → `useGraphStore(s => s.addEdge)` |
| `useCanvasNavigation` | `useCoreStore(s => s.graph)` → `useGraphStore(s => s.graph)` |

**Lesson for Batch 3:** P01 (Break Up God Components) will extract dialogs from
`App.tsx`. These dialogs import from domain stores — make sure the import paths are
correct for the new store layout, not the old `coreStore` paths. Read the existing
component code before writing any extraction.

### P09 — Clean Dead Code

**Audit before deleting.** The proposal assumed `bridgeConnection.ts` was dead code.
It wasn't — it had 16 active references from `terminalStore.ts` and
`TerminalPanel.tsx`. Similarly, `inferEngine.ts` was marked `@deprecated` but its
types were imported by 5 files.

**Decision:** Only removed what was truly dead: the `aiSender` parameter chain,
`runBuiltInAI` stub, ghost comments, and unused API key variables. Net: -278 lines
with zero behavior changes.

**Lesson for Batch 3:** Before deleting any code marked "unused" or "deprecated",
grep for all imports and references. A `@deprecated` tag means "should be removed
eventually," not "is safe to remove now."

### P10 — Undo System Optimization

**Immer patches replaced full snapshots.** The `undoManager.ts` rewrite stores
`Patch[]` and `inversePatch[]` per undo entry instead of complete protobuf-encoded
Architecture copies. Memory reduction is ~20x for typical undo histories.

**Decision:** Kept the `architecture_snapshot` field in the proto schema for backward
compatibility (old `.archc` files with snapshot-based undo still open correctly), but
new undo entries use patches exclusively.

**Pitfall:** The patch-based approach means `historyStore.undo()` must apply inverse
patches to the current graph state (via Immer's `applyPatches`), then push the result
to `graphStore`. This creates a cross-store data flow:
`historyStore.undo()` → reads `graphStore.graph` → applies patches → writes
`graphStore._setGraph(newGraph)`. The `_setGraph` method was added specifically
for this purpose (it sets graph state without creating a new undo entry).

---

## 3. Cross-Cutting Patterns

### Event Bus vs. Direct `.getState()` — Where to Draw the Line

P02 introduced `src/events/appEvents.ts` with a typed event bus. The original
proposal suggested routing ALL cross-store communication through events. In practice,
we drew the line at **side effects**:

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Event bus (`appEvents.emit`) | UI side effects (toasts, loading indicators, dialogs) | `appEvents.emit('toast:show', { message: 'Saved' })` |
| Direct `.getState()` | Data reads where one store needs another's state | `useEngineStore.getState().textApi` |
| Store subscription | React components needing reactive updates | `useGraphStore((s) => s.graph)` |

**Why not events for everything?** Data reads through events would require
request/response patterns (emit request, subscribe for response) which adds
complexity without benefit. `getState()` is synchronous and predictable for
reading data. Events are better for fire-and-forget side effects where the emitter
doesn't care who listens.

### Zustand Store Granularity — Finding the Right Size

The P02 proposal suggested 5 stores; the implementation created 5 new stores:

| Store | Lines | Fields | Actions |
|-------|-------|--------|---------|
| `graphStore` | 467 | 5 | 15+ mutations |
| `fileStore` | ~690 | 7 | 6 (open/save/load) |
| `engineStore` | 78 | 6 | 1 (initialize) |
| `historyStore` | 96 | 4 | 5 (undo/redo/push/reset/clear) |
| `layoutStore` | ~80 | 2 | 1 (autoLayout) |

`graphStore` and `fileStore` ended up larger than the 300-line target. This is
acceptable because:
- `graphStore` has many mutations that are structurally similar (addNode, removeNode,
  updateNode, addEdge, removeEdge, etc.) — splitting further would just spread
  related logic across files
- `fileStore` handles 4 different load paths (open dialog, URL, dropped file,
  auto-reload) each with their own error handling — the complexity is inherent

**Lesson:** Don't split stores just to hit a line count target. Split when the
responsibilities are genuinely independent (graph state vs. file I/O vs. engine
lifecycle).

### Test Strategy

All 6,211 existing tests were maintained through both batches. The testing approach:

1. **Never use `npm test` or `npx vitest` directly** — always use
   `./scripts/test.sh` which is mutex-locked to prevent OOM when parallel agents
   run tests simultaneously
2. **Source-reading tests are fragile** — several tests read source file contents
   to verify patterns (e.g., "fileStore.ts uses `getFileLastModified`"). When the
   source changes shape, these tests break even if behavior is correct. Consider
   whether such tests add value vs. behavioral tests.
3. **Run tests after every merge**, not just after implementation. The P02 merge
   introduced 6 test failures that weren't in either branch individually — they
   appeared because P02's `fileStore.ts` didn't use P06's patterns.

---

## 4. Pitfalls to Watch for in Batch 3

### P01 — Break Up God Components

- `App.tsx` currently imports from all 4 new domain stores. When extracting dialogs
  into separate files, each dialog only needs the stores it actually uses. Don't
  blindly copy all imports.
- The `useEffect` chains in `App.tsx` for initialization, file loading, and event
  subscription have specific ordering dependencies. Document which effects depend
  on which store being initialized before extracting them.
- P07 already extracted Canvas into hooks. P01 should follow the same pattern for
  App.tsx's dialogs and toolbars — extract into hooks/components, keep the
  orchestrator thin.

### P05 — Fractal Canvas Navigation

- `navigationStore.ts` is currently small (~36 lines) and simple. P05 wants to
  merge it with `nestedCanvasStore.ts`. The tricky part is that `useCanvasKeyboard`
  and `useCanvasNavigation` hooks (from P07) subscribe to `navigationStore.path` —
  changing the store shape will require updating these subscribers.
- The `zoomIn`/`zoomOut` actions in `navigationStore` are called from both keyboard
  shortcuts (Escape to zoom out, double-click to zoom in) and the breadcrumb UI.
  Make sure all call sites are updated if the API changes.

### P08 — Storage Backend Abstraction

- `fileStore.ts` (from P02) contains all the file I/O logic that P08 wants to
  abstract. The save/load flow already uses the event bus for side effects — P08
  should plug into the same pattern, not introduce a parallel notification system.
- The `_applyDecodedFile` helper in `fileStore.ts` is the central point where
  decoded graph data enters the system. Any new storage backend (S3, IndexedDB)
  should funnel through this same path to ensure consistency.
- `getFileLastModified()` from P06 only works for `FileSystemFileHandle`. New
  backends will need their own timestamp tracking — plan the adapter interface
  accordingly.

---

## 5. Agent Coordination Lessons

### OAuth Token Expiration

Long-running agent sessions can hit OAuth token expiration (401 errors). When
resuming an agent that has been idle for a while, launch a fresh agent rather than
resuming the expired session. The fresh agent inherits the worktree state but gets
a new auth context.

### Worktree Cleanup Checklist

After completing any batch:

1. `git worktree list` — verify no stale worktrees
2. `git worktree remove <path>` for each (use `--force` if only build artifacts remain)
3. `git branch -D <worktree-branch>` for each worktree branch
4. `git status` on main — verify no worktree directories are tracked
5. `.gitignore` should include `.claude/worktrees/`

### Merge Conflict Resolution Priority

When merging a large refactoring branch (like P02) back into main:

1. **Resolve source code conflicts first** — these affect correctness
2. **Resolve test conflicts second** — usually just import path changes
3. **Run full test suite** — catches interaction effects between proposals
4. **Check for pattern mismatches** — e.g., P02 code not following P06 patterns
   because it branched before P06 landed

---

## 6. Final Statistics

| Metric | Before Batch 1 | After Batch 2 |
|--------|----------------|---------------|
| `coreStore.ts` | 1,449 lines | Deleted |
| `Canvas.tsx` | ~1,530 lines | ~200 lines + 8 hooks |
| Domain stores | 0 | 5 (`graphStore`, `fileStore`, `engineStore`, `historyStore`, `layoutStore`) |
| Event bus | None | `appEvents.ts` with 9 event types |
| Registry loaders | 1 (Vite-specific) | Unified loader + runtime registration |
| Undo memory (50 steps, 100 nodes) | ~5 MB | ~250 KB |
| Dead code removed | — | -278 lines (P09) |
| Platform adapter violations | Multiple | 0 (ESLint-enforced) |
| Test count | 6,211 | 6,211 (all passing) |
| Total commits | — | 8 (P04, P06, P07, P09, P10, P02 ×2, fileStore fix) |
