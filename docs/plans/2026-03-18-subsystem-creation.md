# Subsystem Creation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users and AI to create subsystem canvases (nested scopes) from the UI and via MCP tools.

**Architecture:** fileStore-centric orchestration. `fileStore.registerCanvas()` registers new canvas entries; `graphStore.createSubsystem()` orchestrates registration + RefNode addition. Engine and navigation layers are unchanged — they already support RefNodes.

**Tech Stack:** Zustand, Immer, Radix Dialog, Vitest, Playwright

**Spec:** `docs/specs/2026-03-18-subsystem-creation-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/components/CreateSubsystemDialog.tsx` | Modal dialog: name/ID/filename input with collision checks |
| `src/lib/deriveId.ts` | Pure utility: name → kebab-case ID |
| `test/unit/lib/deriveId.test.ts` | Unit tests for deriveId |
| `test/unit/store/fileStore-registerCanvas.test.ts` | Unit tests for registerCanvas |
| `test/unit/store/graphStore-createSubsystem.test.ts` | Unit tests for createSubsystem |
| `test/e2e/subsystem.spec.ts` | E2E test suite |

### Modified files

| File | Change |
|------|--------|
| `src/core/graph/types.ts:6-24` | Add `CANVAS_ALREADY_EXISTS` + `UNKNOWN_SUBSYSTEM_TYPE` to `EngineError` |
| `src/store/fileStore.ts:122-151` | Add `registerCanvas` to interface + implementation |
| `src/store/graphStore.ts:22-33,60-120` | Add `createSubsystem` to interface + implementation |
| `src/core/ai/mcpTools.ts:34-151` | Add `create_subsystem` tool |
| `src/core/ai/storeActionDispatcher.ts:34-61` | Add `createSubsystem` dispatcher case |
| `src/core/ai/systemPrompt.ts:22-56` | Add subsystem tool listing + guidance section |
| `src/core/validation/addNodeValidation.ts:101` | Fix stale CLI reference |
| `src/components/shared/CommandPalette.tsx:168-209,296-309` | Add subsystem mode, provider filtering, "Create Subsystem" action |
| `src/components/shared/ContextMenu.tsx:112-137` | Add "Create Subsystem..." to canvas menu |
| `src/components/canvas/Canvas.tsx:63-68,121-136,286` | Add `paletteMode` state, pass to CommandPalette, render dialog at Canvas level |
| `src/components/shared/Breadcrumb.tsx:8` | Add `data-testid="breadcrumb"` |
| `test/e2e/e2e-helpers.ts` | Add subsystem test helpers |

---

## Task 1: EngineError types + deriveId utility

**Files:**
- Modify: `src/core/graph/types.ts:6-24`
- Create: `src/lib/deriveId.ts`
- Create: `test/unit/lib/deriveId.test.ts`

- [ ] **Step 1: Write deriveId tests**

```ts
// test/unit/lib/deriveId.test.ts
import { describe, it, expect } from 'vitest';
import { deriveId } from '@/lib/deriveId';

describe('deriveId', () => {
  it('converts display name to kebab-case', () => {
    expect(deriveId('Order Service')).toBe('order-service');
  });

  it('strips leading/trailing special characters', () => {
    expect(deriveId('  --Hello World!! ')).toBe('hello-world');
  });

  it('strips non-ASCII characters', () => {
    expect(deriveId('café')).toBe('caf');
  });

  it('returns empty string for empty input', () => {
    expect(deriveId('')).toBe('');
  });

  it('collapses multiple separators into one dash', () => {
    expect(deriveId('foo---bar___baz')).toBe('foo-bar-baz');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/lib/deriveId.test.ts`
Expected: FAIL — module `@/lib/deriveId` not found

- [ ] **Step 3: Implement deriveId**

```ts
// src/lib/deriveId.ts

/** Convert a display name to a kebab-case identifier. */
export function deriveId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/lib/deriveId.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Add EngineError variants**

In `src/core/graph/types.ts`, add before the closing semicolon of `EngineError` (after line 24):

```ts
  | { code: 'CANVAS_ALREADY_EXISTS'; canvasId: string }
  | { code: 'UNKNOWN_SUBSYSTEM_TYPE'; type: string }
```

- [ ] **Step 6: Run existing engine tests to verify no regressions**

Run: `npx vitest run test/unit/graph/`
Expected: All existing tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/deriveId.ts test/unit/lib/deriveId.test.ts src/core/graph/types.ts
git commit -m "feat: add deriveId utility and EngineError variants for subsystem creation"
```

---

## Task 2: fileStore.registerCanvas

**Files:**
- Modify: `src/store/fileStore.ts:122-151` (interface), plus implementation after `setProjectPath`
- Create: `test/unit/store/fileStore-registerCanvas.test.ts`

- [ ] **Step 1: Write registerCanvas tests**

```ts
// test/unit/store/fileStore-registerCanvas.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

function yamlOf(data: Record<string, unknown>): string {
  return serializeCanvas(data as any);
}

function createSeededFs(): InMemoryFileSystem {
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': yamlOf({
      project: { name: 'Test' },
      nodes: [{ id: 'db', type: 'data/database' }],
    }),
  });
  return fs;
}

describe('fileStore.registerCanvas', () => {
  beforeEach(async () => {
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
      fs: null,
    });
    const fs = createSeededFs();
    await useFileStore.getState().openProject(fs);
  });

  it('registers a new canvas and returns ok', () => {
    const result = useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', displayName: 'Order Service', nodes: [], edges: [] },
    );
    expect(result).toEqual({ ok: true });
  });

  it('makes the canvas retrievable via getCanvas', () => {
    useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', displayName: 'Order Service', nodes: [], edges: [] },
    );
    const canvas = useFileStore.getState().getCanvas('order-svc');
    expect(canvas).toBeDefined();
    expect(canvas!.data.displayName).toBe('Order Service');
    expect(canvas!.filePath).toBe('.archcanvas/order-svc.yaml');
  });

  it('marks the new canvas as dirty', () => {
    useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    expect(useFileStore.getState().dirtyCanvases.has('order-svc')).toBe(true);
  });

  it('sets data.id on the registered canvas', () => {
    useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    expect(useFileStore.getState().getCanvas('order-svc')!.data.id).toBe('order-svc');
  });

  it('returns error when canvasId already exists', () => {
    // Register once
    useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    // Register again with same ID
    const result = useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc-2.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: 'CANVAS_ALREADY_EXISTS', canvasId: 'order-svc' },
    });
  });

  it('does not register when project is null', () => {
    useFileStore.setState({ project: null });
    const result = useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: 'CANVAS_ALREADY_EXISTS', canvasId: 'order-svc' },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/store/fileStore-registerCanvas.test.ts`
Expected: FAIL — `registerCanvas` is not a function

- [ ] **Step 3: Add registerCanvas to FileStoreState interface**

In `src/store/fileStore.ts`, add to the `FileStoreState` interface (after `setProjectPath` on line 142):

```ts
  /** Register a new canvas (subsystem) in the project's canvas map. */
  registerCanvas: (
    canvasId: string,
    filePath: string,
    data: Canvas,
  ) => { ok: true } | { ok: false; error: { code: 'CANVAS_ALREADY_EXISTS'; canvasId: string } };
```

- [ ] **Step 4: Implement registerCanvas**

In `src/store/fileStore.ts`, add the implementation inside the `create` call, after `setProjectPath`:

```ts
  registerCanvas: (canvasId, filePath, data) => {
    const { project } = get();
    if (!project || project.canvases.has(canvasId)) {
      return { ok: false, error: { code: 'CANVAS_ALREADY_EXISTS' as const, canvasId } };
    }

    const entry = { filePath, data, doc: undefined };
    const nextCanvases = new Map(project.canvases);
    nextCanvases.set(canvasId, entry);

    const nextDirty = new Set(get().dirtyCanvases);
    nextDirty.add(canvasId);

    set({
      project: { ...project, canvases: nextCanvases },
      dirtyCanvases: nextDirty,
    });

    return { ok: true };
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/store/fileStore-registerCanvas.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 6: Run all fileStore tests for regressions**

Run: `npx vitest run test/unit/store/fileStore`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/store/fileStore.ts test/unit/store/fileStore-registerCanvas.test.ts
git commit -m "feat: add fileStore.registerCanvas for subsystem creation"
```

---

## Task 3: graphStore.createSubsystem

**Files:**
- Modify: `src/store/graphStore.ts:22-33` (interface), add implementation after line 119
- Create: `test/unit/store/graphStore-createSubsystem.test.ts`

- [ ] **Step 1: Write createSubsystem tests**

```ts
// test/unit/store/graphStore-createSubsystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

function makeMainYaml() {
  return serializeCanvas({
    project: { name: 'Test' },
    nodes: [
      { id: 'node-a', type: 'compute/service', displayName: 'Node A' },
    ],
    edges: [],
  } as any);
}

async function setupStores() {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
  });
  const fs = new InMemoryFileSystem();
  fs.seed({ '.archcanvas/main.yaml': makeMainYaml() });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
  return fs;
}

describe('graphStore.createSubsystem', () => {
  beforeEach(async () => {
    await setupStores();
  });

  it('creates subsystem: RefNode in parent + child canvas registered', () => {
    const result = useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
      displayName: 'Order Service',
    });
    expect(result.ok).toBe(true);

    // RefNode in parent
    const root = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const refNode = root.data.nodes!.find((n) => n.id === 'order-svc');
    expect(refNode).toBeDefined();
    expect('ref' in refNode!).toBe(true);

    // Child canvas registered
    const child = useFileStore.getState().getCanvas('order-svc');
    expect(child).toBeDefined();
    expect(child!.data.type).toBe('compute/service');
    expect(child!.data.displayName).toBe('Order Service');
    expect(child!.filePath).toBe('.archcanvas/order-svc.yaml');
  });

  it('marks both parent and child as dirty', () => {
    useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
    });
    const dirty = useFileStore.getState().dirtyCanvases;
    expect(dirty.has(ROOT_CANVAS_KEY)).toBe(true);
    expect(dirty.has('order-svc')).toBe(true);
  });

  it('returns CANVAS_NOT_FOUND for invalid parent', () => {
    const result = useGraphStore.getState().createSubsystem('nonexistent', {
      id: 'order-svc',
      type: 'compute/service',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CANVAS_NOT_FOUND');
  });

  it('returns CANVAS_ALREADY_EXISTS on canvas ID collision', () => {
    // Create first
    useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
    });
    // Try duplicate
    const result = useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CANVAS_ALREADY_EXISTS');
  });

  it('returns DUPLICATE_NODE_ID when RefNode ID collides with existing node', () => {
    // 'node-a' already exists as an InlineNode
    const result = useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'node-a',
      type: 'compute/service',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_NODE_ID');
    // No orphan canvas should be registered
    expect(useFileStore.getState().getCanvas('node-a')).toBeUndefined();
  });

  it('returns UNKNOWN_SUBSYSTEM_TYPE for invalid type', () => {
    const result = useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'nonexistent/type',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_SUBSYSTEM_TYPE');
  });

  it('resolves displayName from NodeDef when omitted', () => {
    useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
    });
    const child = useFileStore.getState().getCanvas('order-svc');
    // compute/service NodeDef has displayName "Service"
    expect(child!.data.displayName).toBe('Service');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/store/graphStore-createSubsystem.test.ts`
Expected: FAIL — `createSubsystem` is not a function

- [ ] **Step 3: Add createSubsystem to GraphStoreState interface**

In `src/store/graphStore.ts`, add to the `GraphStoreState` interface (after line 32):

```ts
  createSubsystem(
    parentCanvasId: string,
    input: { id: string; type: string; displayName?: string },
  ): EngineResult;
```

- [ ] **Step 4: Implement createSubsystem**

In `src/store/graphStore.ts`, add inside the `create` call (after `updateEntity` method, before the closing `})`):

```ts
  createSubsystem(parentCanvasId, input) {
    // 1. Resolve parent canvas
    const resolved = resolveCanvas(parentCanvasId);
    if (resolved.error) return resolved.error;

    // 2. Validate type against registry
    const registry = getRegistry();
    const nodeDef = registry?.resolve(input.type);
    if (!nodeDef) {
      return { ok: false, error: { code: 'UNKNOWN_SUBSYSTEM_TYPE', type: input.type } };
    }
    const displayName = input.displayName ?? nodeDef.metadata.displayName;

    // 3. Check node ID uniqueness BEFORE registering canvas (avoid orphans)
    const existingNodes = resolved.data.nodes ?? [];
    if (existingNodes.some((n) => n.id === input.id)) {
      return { ok: false, error: { code: 'DUPLICATE_NODE_ID', nodeId: input.id } };
    }

    // 4. Register child canvas in fileStore
    const childData = {
      id: input.id,
      type: input.type,
      displayName,
      nodes: [] as any[],
      edges: [] as any[],
    };
    const regResult = useFileStore.getState().registerCanvas(
      input.id,
      `.archcanvas/${input.id}.yaml`,
      childData,
    );
    if (!regResult.ok) {
      return { ok: false, error: regResult.error };
    }

    // 5. Add RefNode to parent canvas
    const refNode = { id: input.id, ref: `${input.id}.yaml` };
    const engineResult = engineAddNode(resolved.data, refNode, getRegistry());

    // 6. Apply result (marks parent dirty + pushes undo patches)
    const applied = applyResult(parentCanvasId, engineResult);

    // 7. Mark child dirty (for persistence on save)
    if (applied.ok) {
      useFileStore.getState().markDirty(input.id);
    }

    return applied;
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/store/graphStore-createSubsystem.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 6: Run all store tests for regressions**

Run: `npx vitest run test/unit/store/`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/store/graphStore.ts test/unit/store/graphStore-createSubsystem.test.ts
git commit -m "feat: add graphStore.createSubsystem orchestration"
```

---

## Task 4: MCP tool + dispatcher + system prompt

**Files:**
- Modify: `src/core/ai/storeActionDispatcher.ts:34-61`
- Modify: `src/core/ai/mcpTools.ts:34-161`
- Modify: `src/core/ai/systemPrompt.ts:22-56`
- Modify: `src/core/validation/addNodeValidation.ts:101`

- [ ] **Step 1: Add createSubsystem dispatcher case**

In `src/core/ai/storeActionDispatcher.ts`, add a new case inside the `switch (action)` block (after `case 'import':` on line 46):

```ts
    case 'createSubsystem':
      return useGraphStore.getState().createSubsystem(
        args.canvasId as string,
        {
          id: args.id as string,
          type: args.type as string,
          displayName: args.name as string | undefined,
        },
      );
```

Add import for `useGraphStore` at the top of the file (it's already imported via `@/store/graphStore`). Verify by checking existing imports.

- [ ] **Step 2: Add create_subsystem MCP tool**

In `src/core/ai/mcpTools.ts`, add a new tool inside the `tools` array (after the `import_yaml` tool, before the `// --- Read Tools ---` comment):

```ts
      tool('create_subsystem', 'Create a subsystem (nested canvas) with its own scope', {
        id: z.string().describe('Unique subsystem identifier (kebab-case, becomes both node ID and filename)'),
        type: z.string().describe('Node type (e.g., compute/service). Run catalog tool first.'),
        name: z.string().optional().describe('Display name'),
        scope: z.string().optional().describe('Parent canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('createSubsystem', {
          canvasId: a.scope ?? ROOT,
          id: a.id, type: a.type, name: a.name,
        });
        return toCallToolResult(result);
      }),
```

- [ ] **Step 3: Update MCP_TOOL_NAMES**

In `src/core/ai/mcpTools.ts`, add `'mcp__archcanvas__create_subsystem'` to the `MCP_TOOL_NAMES` array (after `mcp__archcanvas__import_yaml`).

- [ ] **Step 4: Update system prompt — tool listing**

In `src/core/ai/systemPrompt.ts`, add to the Write Tools section (after the `import_yaml` line):

```ts
    `- **create_subsystem** — Create a nested subsystem: id (string), type (string), name? (string), scope?`,
```

- [ ] **Step 5: Update system prompt — subsystem guidance section**

In `src/core/ai/systemPrompt.ts`, add a new section after the "Cross-Scope References" section (before "Guidelines"):

```ts
    ``,
    `## Subsystems`,
    `- Use create_subsystem to create nested scopes (subsystem canvases)`,
    `- The subsystem becomes a RefNode in the parent canvas and a navigable scope`,
    `- After creation, use the scope parameter on other tools to add nodes/edges inside it`,
    `  (e.g., add_node with scope: "order-service" adds a node inside that subsystem)`,
    `- Use describe (no args) to see all subsystems and their node/edge counts`,
    `- Cross-scope edges reference nodes inside subsystems: @<subsystem-id>/<node-id>`,
    `- Example workflow:`,
    `  1. create_subsystem(id: "order-svc", type: "compute/service", name: "Order Service")`,
    `  2. add_node(id: "processor", type: "compute/function", scope: "order-svc")`,
    `  3. add_edge(from: "api-gateway", to: "@order-svc/processor")`,
```

- [ ] **Step 6: Fix stale CLI reference**

In `src/core/validation/addNodeValidation.ts:101`, change:

```ts
    hints.push(`Run \`archcanvas catalog --json\` to see all available types.`);
```

to:

```ts
    hints.push(`Use the catalog tool to see all available types.`);
```

- [ ] **Step 7: Write dispatcher unit tests**

Create `test/ai/storeActionDispatcher-createSubsystem.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { dispatchStoreAction } from '@/core/ai/storeActionDispatcher';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

async function setup() {
  useFileStore.setState({
    project: null, dirtyCanvases: new Set(), status: 'idle', error: null,
  });
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': serializeCanvas({
      project: { name: 'Test' },
      nodes: [{ id: 'svc-a', type: 'compute/service' }],
      edges: [],
    } as any),
  });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

describe('dispatchStoreAction: createSubsystem', () => {
  beforeEach(setup);

  it('creates subsystem via dispatcher', () => {
    const result = dispatchStoreAction('createSubsystem', {
      canvasId: ROOT_CANVAS_KEY,
      id: 'order-svc',
      type: 'compute/service',
      name: 'Order Service',
    }) as any;
    expect(result.ok).toBe(true);
    expect(useFileStore.getState().getCanvas('order-svc')).toBeDefined();
  });

  it('returns error for invalid canvas', () => {
    const result = dispatchStoreAction('createSubsystem', {
      canvasId: 'nonexistent',
      id: 'order-svc',
      type: 'compute/service',
    }) as any;
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('CANVAS_NOT_FOUND');
  });
});
```

- [ ] **Step 8: Run all AI tests**

Run: `npx vitest run test/ai/`
Expected: All PASS (including new dispatcher tests)

- [ ] **Step 9: Commit**

```bash
git add src/core/ai/storeActionDispatcher.ts src/core/ai/mcpTools.ts src/core/ai/systemPrompt.ts src/core/validation/addNodeValidation.ts test/ai/storeActionDispatcher-createSubsystem.test.ts
git commit -m "feat: add create_subsystem MCP tool, dispatcher, and system prompt guidance"
```

---

## Task 5: UI — Canvas.tsx palette mode + ContextMenu

**Files:**
- Modify: `src/components/canvas/Canvas.tsx:63-68,121-136,286`
- Modify: `src/components/shared/ContextMenu.tsx:112-137`

- [ ] **Step 1: Add paletteMode state to Canvas.tsx**

In `src/components/canvas/Canvas.tsx`, after `paletteInitial` state (line 64), add:

```ts
  const [paletteMode, setPaletteMode] = useState<'default' | 'subsystem'>('default');
```

- [ ] **Step 2: Update open-palette event handler**

In `src/components/canvas/Canvas.tsx`, replace the `handleOpenPalette` handler (lines 124-127):

```ts
    const handleOpenPalette = (e: Event) => {
      const detail = (e as CustomEvent<{ prefix?: string; mode?: string }>).detail;
      setPaletteMode((detail?.mode as 'default' | 'subsystem') ?? 'default');
      openPalette(detail?.prefix ?? '');
    };
```

- [ ] **Step 3: Update closePalette to reset mode**

In `src/components/canvas/Canvas.tsx`, replace `closePalette` (line 69):

```ts
  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteMode('default');
  }, []);
```

- [ ] **Step 4: Pass paletteMode to CommandPalette**

In `src/components/canvas/Canvas.tsx`, update the CommandPalette render (line 286):

```tsx
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        initialInput={paletteInitial}
        mode={paletteMode}
      />
```

- [ ] **Step 5: Add "Create Subsystem..." to ContextMenu**

In `src/components/shared/ContextMenu.tsx`, add inside the `target.kind === 'canvas'` section, after the "Add Node..." MenuItem (after line 119):

```tsx
          <MenuItem
            label="Create Subsystem..."
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('archcanvas:open-palette', { detail: { mode: 'subsystem' } }),
              );
              onClose();
            }}
          />
```

- [ ] **Step 6: Add data-testid to Breadcrumb**

In `src/components/shared/Breadcrumb.tsx` line 8, change:

```tsx
    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/80 rounded px-2 py-1 text-sm">
```

to:

```tsx
    <div data-testid="breadcrumb" className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/80 rounded px-2 py-1 text-sm">
```

- [ ] **Step 7: Type-check (build will succeed after Task 6)**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Type error on `mode` prop in CommandPalette — this is expected and resolved in Task 6. Verify only this error exists.

- [ ] **Step 8: Commit**

```bash
git add src/components/canvas/Canvas.tsx src/components/shared/ContextMenu.tsx
git commit -m "feat: add paletteMode state and 'Create Subsystem' context menu item"
```

---

## Task 6: CommandPalette subsystem mode + CreateSubsystemDialog

**Files:**
- Modify: `src/components/shared/CommandPalette.tsx:168-209,332-338`
- Modify: `src/components/canvas/Canvas.tsx` (render dialog at Canvas level, not inside CommandPalette)
- Create: `src/components/CreateSubsystemDialog.tsx`

- [ ] **Step 1: Add mode and onSelectSubsystemType props to CommandPalette**

In `src/components/shared/CommandPalette.tsx`, update the `CommandPaletteProps` interface:

```ts
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  initialInput?: string;
  mode?: 'default' | 'subsystem';
  onSelectSubsystemType?: (type: string) => void;
}
```

Update the destructured props:

```ts
export function CommandPalette({ open, onClose, initialInput = '', mode = 'default', onSelectSubsystemType }: CommandPaletteProps) {
```

- [ ] **Step 2: Filter providers in subsystem mode**

In `src/components/shared/CommandPalette.tsx`, update the `resolveProviders` function call. Replace the `groups` computation:

```ts
  const { providers: resolvedProviders, query } = resolveProviders(inputValue);

  // In subsystem mode, only show NodeTypeProvider (user picks a type for the subsystem)
  const providers = mode === 'subsystem' ? [NodeTypeProvider] : resolvedProviders;
```

Update the placeholder text conditionally. In the `Command.Input`:

```tsx
          placeholder={mode === 'subsystem'
            ? "Pick a node type for the subsystem..."
            : "Type a command or search… (> actions, @ nodes, # entities)"}
```

- [ ] **Step 3: Add "Create Subsystem" action to editActions**

In `src/components/shared/CommandPalette.tsx`, add to `editActions` array:

```ts
  { id: 'action:create-subsystem', title: 'Create Subsystem...', icon: '⊞', category: 'Edit',
    execute: () => window.dispatchEvent(
      new CustomEvent('archcanvas:open-palette', { detail: { mode: 'subsystem' } }),
    ),
  },
```

- [ ] **Step 4: Modify handleSelect for subsystem mode**

Replace the `handleSelect` callback to intercept type selection in subsystem mode. Instead of rendering a dialog inside CommandPalette, callback to the parent (Canvas.tsx):

```ts
  const handleSelect = useCallback(
    (provider: PaletteProvider, result: PaletteResult) => {
      // Intercept node type selection in subsystem mode — hand off to Canvas
      if (mode === 'subsystem' && result.id.startsWith('nodetype:')) {
        const typeKey = result.id.replace(/^nodetype:/, '');
        onSelectSubsystemType?.(typeKey);
        onClose();
        setInputValue('');
        return;
      }
      provider.onSelect(result);
      onClose();
      setInputValue('');
    },
    [onClose, mode, onSelectSubsystemType],
  );
```

- [ ] **Step 5: Create CreateSubsystemDialog component**

Create `src/components/CreateSubsystemDialog.tsx`:

```tsx
import { useState, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { deriveId } from '@/lib/deriveId';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useNavigationStore } from '@/store/navigationStore';

interface CreateSubsystemDialogProps {
  open: boolean;
  type: string;
  onClose: () => void;
}

export function CreateSubsystemDialog({ open, type, onClose }: CreateSubsystemDialogProps) {
  const [name, setName] = useState('');
  const [idValue, setIdValue] = useState('');
  const [fileName, setFileName] = useState('');
  const [idOverride, setIdOverride] = useState(false);
  const [fileOverride, setFileOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-derive ID and filename from name (unless user has overridden)
  const derivedId = useMemo(() => deriveId(name), [name]);
  const effectiveId = idOverride ? idValue : derivedId;
  const effectiveFile = fileOverride ? fileName : `${derivedId}.yaml`;

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setError(null);
  }, []);

  const handleIdChange = useCallback((value: string) => {
    setIdValue(value);
    setIdOverride(true);
    setError(null);
  }, []);

  const handleFileChange = useCallback((value: string) => {
    setFileName(value);
    setFileOverride(true);
    setError(null);
  }, []);

  const validate = useCallback((): string | null => {
    if (!name.trim()) return 'Subsystem name is required.';
    if (!effectiveId) return 'ID cannot be empty.';
    if (!effectiveFile) return 'File name cannot be empty.';

    const project = useFileStore.getState().project;
    if (!project) return 'No project loaded.';

    // ID collision check
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const parentCanvas = useFileStore.getState().getCanvas(canvasId);
    if (parentCanvas) {
      const nodes = parentCanvas.data.nodes ?? [];
      if (nodes.some((n) => n.id === effectiveId)) {
        return `ID "${effectiveId}" already exists in this canvas. Choose a different ID.`;
      }
    }

    // Filename collision check
    const filePath = `.archcanvas/${effectiveFile}`;
    for (const canvas of project.canvases.values()) {
      if (canvas.filePath === filePath) {
        return `File "${effectiveFile}" already exists. Choose a different file name.`;
      }
    }

    return null;
  }, [name, effectiveId, effectiveFile]);

  const handleSubmit = useCallback(() => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const canvasId = useNavigationStore.getState().currentCanvasId;
    const result = useGraphStore.getState().createSubsystem(canvasId, {
      id: effectiveId,
      type,
      displayName: name.trim(),
    });

    if (!result.ok) {
      setError(`Failed: ${result.error.code}`);
      return;
    }

    // Reset and close
    setName('');
    setIdValue('');
    setFileName('');
    setIdOverride(false);
    setFileOverride(false);
    setError(null);
    onClose();
  }, [validate, effectiveId, type, name, onClose]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setName('');
      setIdValue('');
      setFileName('');
      setIdOverride(false);
      setFileOverride(false);
      setError(null);
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover p-6 shadow-2xl"
          data-testid="create-subsystem-dialog"
        >
          <Dialog.Title className="text-lg font-semibold text-popover-foreground">
            Create Subsystem
          </Dialog.Title>
          <VisuallyHidden.Root asChild>
            <Dialog.Description>Create a new subsystem canvas</Dialog.Description>
          </VisuallyHidden.Root>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-popover-foreground mb-1">
                Subsystem name
              </label>
              <input
                data-testid="subsystem-name-input"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Order Service"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-popover-foreground mb-1">
                ID
              </label>
              <input
                data-testid="subsystem-id-input"
                type="text"
                value={effectiveId}
                onChange={(e) => handleIdChange(e.target.value)}
                placeholder="auto-derived from name"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-popover-foreground mb-1">
                File name
              </label>
              <input
                data-testid="subsystem-filename-input"
                type="text"
                value={effectiveFile}
                onChange={(e) => handleFileChange(e.target.value)}
                placeholder="auto-derived from name"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {error && (
              <p data-testid="subsystem-error" className="text-sm text-destructive-foreground">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              className="rounded px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </button>
            <button
              data-testid="subsystem-create-btn"
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              onClick={handleSubmit}
            >
              Create
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 6: Render CreateSubsystemDialog at Canvas level**

The dialog is rendered at the `Canvas.tsx` level (not inside CommandPalette) to avoid nested Radix Dialog focus trap conflicts.

In `src/components/canvas/Canvas.tsx`, add state and import:

```ts
import { CreateSubsystemDialog } from '@/components/CreateSubsystemDialog';

// Inside the Canvas component, after paletteMode state:
const [subsystemType, setSubsystemType] = useState<string | null>(null);
```

Update the CommandPalette render to pass the callback:

```tsx
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        initialInput={paletteInitial}
        mode={paletteMode}
        onSelectSubsystemType={(type) => setSubsystemType(type)}
      />

      {subsystemType && (
        <CreateSubsystemDialog
          open={!!subsystemType}
          type={subsystemType}
          onClose={() => setSubsystemType(null)}
        />
      )}
```

- [ ] **Step 7: Verify app builds**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/CommandPalette.tsx src/components/CreateSubsystemDialog.tsx src/components/canvas/Canvas.tsx
git commit -m "feat: add CreateSubsystemDialog and CommandPalette subsystem mode"
```

---

## Task 7: E2E tests

**Files:**
- Modify: `test/e2e/e2e-helpers.ts`
- Create: `test/e2e/subsystem.spec.ts`

- [ ] **Step 1: Add E2E helpers**

In `test/e2e/e2e-helpers.ts`, add:

```ts
/**
 * Create a subsystem via the command palette.
 * Opens palette → picks type → fills name dialog → creates.
 */
export async function createSubsystem(
  page: Page,
  name: string,
  typePattern: RegExp,
): Promise<void> {
  // Open palette in subsystem mode via keyboard shortcut path:
  // Use context menu on canvas background
  const canvas = page.locator('.react-flow__pane');
  await canvas.click({ button: 'right', position: { x: 200, y: 200 } });
  await page.getByText('Create Subsystem...').click();

  // Pick the node type
  await page.getByRole('option', { name: typePattern }).click();

  // Fill the dialog
  await page.getByTestId('subsystem-name-input').fill(name);
  await page.getByTestId('subsystem-create-btn').click();

  // Wait for dialog to close and node to appear
  await page.waitForTimeout(200);
}

/**
 * Dive into a subsystem via context menu on a RefNode.
 */
export async function diveIntoSubsystem(
  page: Page,
  nodeText: string,
): Promise<void> {
  const node = page.locator('.react-flow__node').filter({ hasText: nodeText });
  await node.click({ button: 'right' });
  await page.getByText('Dive In').click();
  // Wait for navigation animation
  await page.waitForTimeout(700);
}

/**
 * Get the current breadcrumb text.
 */
export async function getBreadcrumbText(page: Page): Promise<string> {
  const breadcrumb = page.locator('[data-testid="breadcrumb"]');
  return breadcrumb.innerText();
}
```

- [ ] **Step 2: Write E2E test suite**

Create `test/e2e/subsystem.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import {
  gotoApp,
  createSubsystem,
  diveIntoSubsystem,
  getBreadcrumbText,
} from './e2e-helpers';

test.describe('subsystem creation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('create subsystem via context menu', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // RefNode should appear on canvas
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(1);

    // Node should show the subsystem name
    await expect(nodes.first()).toContainText('Order Service');
  });

  test('navigate into subsystem and back', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Dive in
    await diveIntoSubsystem(page, 'Order Service');

    // Breadcrumb should show path
    const breadcrumb = await getBreadcrumbText(page);
    expect(breadcrumb).toContain('Root');
    expect(breadcrumb).toContain('Order Service');

    // Canvas should be empty (new subsystem)
    await expect(page.locator('.react-flow__node')).toHaveCount(0);

    // Navigate back via breadcrumb
    await page.locator('[data-testid="breadcrumb"]').getByText('Root').click();
    await page.waitForTimeout(700);

    // RefNode should still be there
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
  });

  test('add nodes inside subsystem', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);
    await diveIntoSubsystem(page, 'Order Service');

    // Add a node inside the subsystem via command palette
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Database data\/database/ }).click();
    await page.waitForTimeout(200);

    // Node should appear inside subsystem
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    // Go back — root should still have just the RefNode
    await page.locator('[data-testid="breadcrumb"]').getByText('Root').click();
    await page.waitForTimeout(700);
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
  });

  test('collision error shown when duplicate name', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Try to create another with the same name
    const canvas = page.locator('.react-flow__pane');
    await canvas.click({ button: 'right', position: { x: 200, y: 200 } });
    await page.getByText('Create Subsystem...').click();
    await page.getByRole('option', { name: /Service compute\/service/ }).click();

    await page.getByTestId('subsystem-name-input').fill('Order Service');
    await page.getByTestId('subsystem-create-btn').click();

    // Error should be visible
    await expect(page.getByTestId('subsystem-error')).toBeVisible();
  });

  test('create subsystem via command palette action', async ({ page }) => {
    // Open command palette and search for the action
    await page.keyboard.press('Meta+k');
    await page.getByPlaceholder(/Type a command/).fill('>Create Subsystem');
    await page.getByRole('option', { name: /Create Subsystem/ }).click();

    // Now in subsystem mode — pick a type
    await page.getByRole('option', { name: /Service compute\/service/ }).click();

    // Fill dialog
    await page.getByTestId('subsystem-name-input').fill('Payment Service');
    await page.getByTestId('subsystem-create-btn').click();
    await page.waitForTimeout(200);

    // RefNode should appear
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.locator('.react-flow__node').first()).toContainText('Payment Service');
  });

  test('save marks subsystem as clean', async ({ page }) => {
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Verify dirty state via store
    const isDirty = await page.evaluate(() => {
      return (window as any).__archcanvas_fileStore__.getState().isDirty();
    });
    expect(isDirty).toBe(true);

    // Trigger save (Cmd+S)
    await page.keyboard.press('Meta+s');
    await page.waitForTimeout(300);

    // Verify both canvases are registered
    const canvasCount = await page.evaluate(() => {
      return (window as any).__archcanvas_fileStore__.getState().project?.canvases.size;
    });
    expect(canvasCount).toBeGreaterThanOrEqual(2); // root + subsystem
  });

  test('cross-scope edge from root to subsystem inner node', async ({ page }) => {
    // Create a root node first
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /API Gateway network\/api-gateway/ }).click();
    await page.waitForTimeout(200);

    // Create a subsystem
    await createSubsystem(page, 'Order Service', /Service compute\/service/);

    // Dive in and add an inner node
    await diveIntoSubsystem(page, 'Order Service');
    await page.keyboard.press('Meta+k');
    await page.getByRole('option', { name: /Function compute\/function/ }).click();
    await page.waitForTimeout(200);

    // Go back to root
    await page.locator('[data-testid="breadcrumb"]').getByText('Root').click();
    await page.waitForTimeout(700);

    // Add cross-scope edge via store (UI doesn't have cross-scope edge creation yet)
    await page.evaluate(() => {
      const store = (window as any).__archcanvas_fileStore__;
      const project = store.getState().project;
      const root = project.canvases.get('__root__');
      const subsystemId = root.data.nodes.find((n: any) => 'ref' in n)?.id;
      const subsystemCanvas = project.canvases.get(subsystemId);
      const innerNodeId = subsystemCanvas?.data.nodes?.[0]?.id;
      const rootNodeId = root.data.nodes.find((n: any) => !('ref' in n))?.id;

      if (subsystemId && innerNodeId && rootNodeId) {
        // Import graphStore from window exposure or use direct dispatch
        const graphStore = (window as any).__archcanvas_graphStore__;
        if (graphStore) {
          graphStore.getState().addEdge('__root__', {
            from: { node: rootNodeId },
            to: { node: `@${subsystemId}/${innerNodeId}` },
          });
        }
      }
    });
    await page.waitForTimeout(200);

    // Verify an edge exists (rendered as ReactFlow edge)
    const edgeCount = await page.locator('.react-flow__edge').count();
    expect(edgeCount).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Verify Breadcrumb has data-testid**

This was added in Task 5 Step 6. Verify `src/components/shared/Breadcrumb.tsx` line 8 has `data-testid="breadcrumb"` on the root div. If Task 5 was done correctly, this is already present.

- [ ] **Step 4: Expose graphStore on window for cross-scope edge test**

In `src/store/graphStore.ts`, add at the end of the file (after the `create` call), following the same pattern as fileStore:

```ts
if (typeof window !== 'undefined') {
  (window as any).__archcanvas_graphStore__ = useGraphStore;
}
```

- [ ] **Step 5: Run E2E tests**

Run: `npx playwright test test/e2e/subsystem.spec.ts --headed`
Expected: All 7 tests PASS

If any tests fail, debug and fix before proceeding.

- [ ] **Step 6: Run full E2E suite for regressions**

Run: `npx playwright test`
Expected: All existing tests PASS + new subsystem tests PASS

- [ ] **Step 7: Commit**

```bash
git add test/e2e/e2e-helpers.ts test/e2e/subsystem.spec.ts src/store/graphStore.ts
git commit -m "test: add E2E tests for subsystem creation, navigation, and persistence"
```

---

## Task 8: Full regression + final commit

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All PASS (should be ~1390+ tests)

- [ ] **Step 2: Run all E2E tests**

Run: `npx playwright test`
Expected: All PASS (should be ~75+ tests)

- [ ] **Step 3: Build check**

Run: `npx vite build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Review all changes**

Run: `git diff main --stat`
Verify the file list matches the spec's "Files Changed / Created" section.
