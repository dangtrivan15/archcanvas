# P02: Restructure State Management

**Parallel safety**: FOUNDATIONAL — should complete before P01, P03, P05.
Can run in parallel with P04, P06, P07, P09, P10 (different file sets).

---

## Problem

### coreStore.ts — 1,469 lines, 40+ state fields, 30+ actions

`src/store/coreStore.ts` is the single biggest maintenance problem. It manages:

- **Graph state**: `graph`, `isDirty`, `initialized`
- **Engine instances**: `registry`, `textApi`, `renderApi`, `exportApi`, `undoManager`
- **File I/O**: `fileHandle`, `fileName`, `openFile()`, `saveFile()`, `saveFileAs()`
- **Graph mutations**: `addNode()`, `removeNode()`, `addEdge()`, `removeEdge()`, `updateNode()`, etc.
- **Undo/redo**: `undo()`, `redo()`, `pushUndo()`
- **Layout**: `autoLayout()`, layout spacing
- **Initialization**: `initialize()`, registry loading

### Cross-Store Circular Dependencies

coreStore imports and calls `.getState()` on other stores:
```typescript
// coreStore.ts lines 33-38
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
```

**101 cross-store `.getState()` references** across the codebase (found via grep).

### Implicit Data Flow

The save flow touches 4 stores:
```
coreStore.saveFile()
  → checks projectStore.isProjectOpen
  → gets useUIStore.getState().showToast()
  → gets useCanvasStore.getState().requestFitView()
  → calls fileIO.graphToProto()
```

No one can trace this flow without reading the full 1,469 lines.

---

## Proposed Solution

### A. Split coreStore into Domain Stores

```
src/store/
  graphStore.ts       -- Graph object + mutation actions (~300 lines)
  fileStore.ts        -- File handle, dirty flag, save/load (~250 lines)
  engineStore.ts      -- Engine instances, initialization (~150 lines)
  historyStore.ts     -- Undo/redo state and operations (~150 lines)
  layoutStore.ts      -- ELK layout config + auto-layout (~100 lines)
  canvasStore.ts      -- (keep existing, ~215 lines)
  uiStore.ts          -- (slim down from 833 lines, ~300 lines)
  navigationStore.ts  -- (keep existing, ~36 lines)
  projectStore.ts     -- (keep existing, ~744 lines — separate refactor later)
  aiStore.ts          -- (new, placeholder for P03)
```

#### graphStore.ts — Graph State + Mutations

```typescript
interface GraphState {
  graph: ArchGraph;
  isDirty: boolean;

  // Mutations (all immutable — return new graph)
  setGraph: (graph: ArchGraph) => void;
  addNode: (params: AddNodeParams) => string | null;
  removeNode: (id: string) => boolean;
  addEdge: (params: AddEdgeParams) => string | null;
  removeEdge: (id: string) => boolean;
  updateNode: (id: string, updates: NodeUpdates) => boolean;
  updateEdge: (id: string, updates: EdgeUpdates) => boolean;
  addNote: (params: AddNoteParams) => string | null;
  // ... other graph mutations

  // Computed
  nodeCount: () => number;
  edgeCount: () => number;
}
```

#### fileStore.ts — File I/O

```typescript
interface FileState {
  fileHandle: FileSystemFileHandle | null;
  fileName: string;
  filePath: string | null;
  lastSavedAt: number | null;

  // Actions
  openFile: (handle?: FileSystemFileHandle) => Promise<boolean>;
  saveFile: () => Promise<boolean>;
  saveFileAs: () => Promise<boolean>;
  newFile: () => void;
  loadFromUrl: (url: string) => Promise<boolean>;
  loadFromDroppedFile: (file: File) => Promise<boolean>;
}
```

#### engineStore.ts — Engine Instances + Init

```typescript
interface EngineState {
  initialized: boolean;
  registry: RegistryManager | null;
  textApi: TextApi | null;
  renderApi: RenderApi | null;
  exportApi: ExportApi | null;

  initialize: () => Promise<void>;
}
```

#### historyStore.ts — Undo/Redo

```typescript
interface HistoryState {
  undoManager: UndoManager | null;
  canUndo: boolean;
  canRedo: boolean;

  undo: () => void;
  redo: () => void;
  pushSnapshot: (description: string) => void;
}
```

### B. Event Bus for Cross-Store Communication

Replace `.getState()` cross-references with a typed event bus:

```typescript
// src/events/appEvents.ts
import { createEventBus } from './eventBus';

export const appEvents = createEventBus<{
  // Graph events
  'graph:mutated': { description: string };
  'graph:replaced': { graph: ArchGraph; source: string };

  // File events
  'file:opened': { fileName: string; filePath?: string };
  'file:saved': { fileName: string };
  'file:dirty': { isDirty: boolean };
  'file:new': {};

  // UI events
  'toast:show': { message: string; type?: 'info' | 'error' | 'success' };
  'dialog:open': { id: string; props?: Record<string, unknown> };
  'dialog:close': { id: string };

  // Layout events
  'layout:request-fit-view': {};
  'layout:auto-layout-complete': {};
}>();
```

**Event bus implementation (lightweight, no library needed):**
```typescript
// src/events/eventBus.ts
type EventMap = Record<string, unknown>;
type Handler<T> = (payload: T) => void;

export function createEventBus<T extends EventMap>() {
  const handlers = new Map<keyof T, Set<Handler<any>>>();

  return {
    on<K extends keyof T>(event: K, handler: Handler<T[K]>): () => void {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)?.delete(handler);
    },
    emit<K extends keyof T>(event: K, payload: T[K]): void {
      handlers.get(event)?.forEach(h => h(payload));
    },
  };
}
```

**Example — save flow after refactoring:**
```typescript
// fileStore.ts
saveFile: async () => {
  const { graph } = useGraphStore.getState();     // Only reads graph store
  const encoded = await encodeGraph(graph);
  await writeToFileHandle(get().fileHandle, encoded);
  set({ lastSavedAt: Date.now() });
  appEvents.emit('file:saved', { fileName: get().fileName });
  // No more: useUIStore.getState().showToast(...)
  // No more: useCanvasStore.getState().requestFitView()
};

// uiStore.ts — subscribes to event
appEvents.on('file:saved', ({ fileName }) => {
  useUIStore.getState().showToast(`Saved ${fileName}`);
});
```

### C. Zustand Middleware for Cross-Cutting Concerns

```typescript
// Auto-dirty tracking middleware
const withDirtyTracking = (config) => (set, get, api) =>
  config(
    (...args) => {
      set(...args);
      // After any graphStore mutation, mark dirty
      appEvents.emit('file:dirty', { isDirty: true });
    },
    get,
    api
  );

// Auto-undo snapshot middleware
const withUndoSnapshots = (config) => (set, get, api) =>
  config(
    (partial, replace, description) => {
      if (description) {
        useHistoryStore.getState().pushSnapshot(description);
      }
      set(partial, replace);
    },
    get,
    api
  );
```

### D. Migration Strategy

To avoid a "big bang" rewrite:

1. Create the new stores alongside coreStore
2. Move one responsibility at a time (start with historyStore, then layoutStore, etc.)
3. Have coreStore delegate to new stores temporarily
4. Once all responsibilities are moved, delete coreStore
5. Update all consumers (components, hooks) to use the new stores

---

## Files to Modify

| File | Action |
|------|--------|
| `src/store/coreStore.ts` | Split into 5 stores, then delete |
| `src/store/uiStore.ts` | Remove cross-store `.getState()` calls, subscribe to events |
| `src/store/canvasStore.ts` | Remove cross-store references |

**New files:**
- `src/store/graphStore.ts`
- `src/store/fileStore.ts`
- `src/store/engineStore.ts`
- `src/store/historyStore.ts`
- `src/store/layoutStore.ts`
- `src/events/appEvents.ts`
- `src/events/eventBus.ts`

**Files that import from coreStore (all need updating):**
- `src/App.tsx`
- `src/components/canvas/Canvas.tsx`
- `src/components/toolbar/Toolbar.tsx`
- `src/components/toolbar/FileMenu.tsx`
- `src/components/panels/NodeDetailPanel.tsx`
- `src/components/panels/EdgeDetailPanel.tsx`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/hooks/useAutoSaveOnBlur.ts`
- Many more — grep for `useCoreStore` to find all

---

## Acceptance Criteria

1. `coreStore.ts` no longer exists
2. No store uses `.getState()` on another store for side effects
3. Cross-store communication goes through `appEvents`
4. Each new store is under 300 lines
5. All graph mutations still work (add/remove/update nodes and edges)
6. Save/load still works
7. Undo/redo still works
8. `npm run test` passes
9. `npm run build` succeeds
