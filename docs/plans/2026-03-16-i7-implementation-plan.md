# I7 Packaging & Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship ArchCanvas v1 with cross-scope ref redesign, entity panel, protocol compatibility, AI bridge extraction, and Tauri desktop packaging.

**Architecture:** 10 tasks split into 4 parallel execution groups. Core data model changes (§1) flow through engine → UI → cleanup. Entity system (§2) and bridge extraction (§4) are independent tracks.

**Tech Stack:** TypeScript 5.9, Vite 7, React 19, Zustand 5, Zod 4, ReactFlow 12, Vitest 4, Playwright 1.58, Tauri 2.0, Commander.js, ELK.js

**Spec:** `docs/specs/2026-03-16-i7-packaging-and-polish-design.md`
**Task index:** `docs/plans/2026-03-16-i7-packaging-polish-index.md`

---

## Execution Groups

```
Group 1 (parallel): Task 1, Task 6, Task 9
Group 2 (parallel): Task 2, Task 3, Task 7
Group 3 (parallel): Task 4, Task 5, Task 8
Group 4 (sequential): Task 10
```

---

## Chunk 1: Foundation (Tasks 1, 6, 9)

### Task 1: Types + Storage Foundation

**Files:**
- Modify: `src/types/schema.ts:121-124`
- Modify: `src/storage/fileResolver.ts:50-131`
- Test: `test/unit/storage/fileResolver.test.ts`
- Test: `test/unit/types/schema.test.ts`

- [ ] **Step 1.1: Write test — SubsystemCanvas without `id` should validate**

In `test/unit/types/schema.test.ts`, add:

```typescript
it('validates subsystem canvas without id field', () => {
  const canvas = {
    type: 'compute/service',
    displayName: 'Order Service',
    nodes: [],
    edges: [],
  };
  const result = SubsystemCanvas.safeParse(canvas);
  expect(result.success).toBe(true);
});

it('rejects subsystem canvas without type field', () => {
  const canvas = {
    displayName: 'Order Service',
    nodes: [],
    edges: [],
  };
  const result = SubsystemCanvas.safeParse(canvas);
  expect(result.success).toBe(false);
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run test/unit/types/schema.test.ts -t "validates subsystem canvas without id"`
Expected: FAIL — current refinement requires `id != null`

- [ ] **Step 1.3: Implement — change SubsystemCanvas refinement**

In `src/types/schema.ts`, line 121-124, change:

```typescript
// Before
export const SubsystemCanvas = Canvas.refine(
  (f) => f.id != null && f.type != null,
  { message: 'Subsystem canvas must have id and type' },
);

// After
export const SubsystemCanvas = Canvas.refine(
  (f) => f.type != null,
  { message: 'Subsystem canvas must have type' },
);
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx vitest run test/unit/types/schema.test.ts`
Expected: PASS

- [ ] **Step 1.5: Write test — ref with .yaml suffix resolves correctly**

In `test/unit/storage/fileResolver.test.ts`, update existing ref fixtures from `ref: 'svc-api'` to `ref: 'svc-api.yaml'`. Add a new test:

```typescript
it('loads canvas from ref with .yaml suffix without double extension', async () => {
  const fs = new InMemoryFileSystem({
    '.archcanvas/main.yaml': `
nodes:
  - id: svc-api
    ref: svc-api.yaml
`,
    '.archcanvas/svc-api.yaml': `
type: compute/service
displayName: API Service
nodes: []
edges: []
`,
  });
  const project = await loadProject(fs);
  expect(project.errors).toHaveLength(0);
  expect(project.canvases.has('svc-api')).toBe(true);
});
```

- [ ] **Step 1.6: Run test to verify it fails**

Run: `npx vitest run test/unit/storage/fileResolver.test.ts -t "loads canvas from ref with .yaml suffix"`
Expected: FAIL — currently appends `.yaml` producing `.yaml.yaml`

- [ ] **Step 1.7: Implement — remove .yaml append, key by node.id**

In `src/storage/fileResolver.ts`:

Line 81: Change `const filePath = \`.archcanvas/${ref}.yaml\`` to `const filePath = \`.archcanvas/${ref}\``

Line 91: Change `canvases.set(ref, loadedCanvas)` to `canvases.set(node.id, loadedCanvas)`

Also update the `loaded` Set and `ancestors` Set to use `node.id` instead of `ref`:
- Line 66: `ancestors.has(ref)` → `ancestors.has(node.id)`
- Line 75: `loaded.has(ref)` → `loaded.has(node.id)`
- Line 79: `loaded.add(ref)` → `loaded.add(node.id)`
- Line 101: `ancestors.delete(ref)` → `ancestors.delete(node.id)`

Keep `ref` for file path construction only.

- [ ] **Step 1.8: Run test to verify it passes**

Run: `npx vitest run test/unit/storage/fileResolver.test.ts`
Expected: PASS (may need to update other fixtures too)

- [ ] **Step 1.9: Write test — cross-scope edge validation**

```typescript
it('validates @<ref-node-id>/<node-id> edges at load time', async () => {
  const fs = new InMemoryFileSystem({
    '.archcanvas/main.yaml': `
nodes:
  - id: svc-api
    ref: svc-api.yaml
  - id: db
    type: data/database
edges:
  - from: { node: "@svc-api/handler" }
    to: { node: db }
`,
    '.archcanvas/svc-api.yaml': `
type: compute/service
nodes:
  - id: handler
    type: compute/function
edges: []
`,
  });
  const project = await loadProject(fs);
  expect(project.errors).toHaveLength(0);
});

it('reports CROSS_SCOPE_NODE_NOT_FOUND for invalid node in ref', async () => {
  const fs = new InMemoryFileSystem({
    '.archcanvas/main.yaml': `
nodes:
  - id: svc-api
    ref: svc-api.yaml
  - id: db
    type: data/database
edges:
  - from: { node: "@svc-api/nonexistent" }
    to: { node: db }
`,
    '.archcanvas/svc-api.yaml': `
type: compute/service
nodes:
  - id: handler
    type: compute/function
edges: []
`,
  });
  const project = await loadProject(fs);
  expect(project.errors.length).toBeGreaterThan(0);
  expect(project.errors[0].message).toContain('nonexistent');
});
```

- [ ] **Step 1.10: Implement — replace validateRootRefs with validateCrossScopeRefs**

In `src/storage/fileResolver.ts`, replace `validateRootRefs()` (lines 105-131) with:

```typescript
function validateCrossScopeRefs(
  canvases: Map<string, LoadedCanvas>,
  root: LoadedCanvas,
  errors: ResolutionError[],
): void {
  const allCanvases = new Map(canvases);
  allCanvases.set(ROOT_CANVAS_KEY, root);

  for (const [canvasId, canvas] of allCanvases) {
    for (const edge of canvas.data.edges ?? []) {
      for (const side of ['from', 'to'] as const) {
        const endpoint = edge[side];
        if (!endpoint.node.startsWith('@')) continue;

        const slashIdx = endpoint.node.indexOf('/');
        if (slashIdx === -1) {
          errors.push({ message: `Invalid cross-scope ref '${endpoint.node}' in canvas '${canvasId}' — missing /nodeId` });
          continue;
        }

        const refNodeId = endpoint.node.slice(1, slashIdx);
        const targetNodeId = endpoint.node.slice(slashIdx + 1);

        // Check ref-node-id exists in this canvas's nodes
        const nodes = canvas.data.nodes ?? [];
        const refNode = nodes.find(n => n.id === refNodeId && 'ref' in n);
        if (!refNode) {
          // Engine validates this at edge-add time too (CROSS_SCOPE_REF_NOT_FOUND)
          // Here we just check the target node exists
          continue;
        }

        // Check target node exists in the referenced canvas
        const targetCanvas = canvases.get(refNodeId);
        if (!targetCanvas) {
          errors.push({ message: `Cross-scope ref '@${refNodeId}/${targetNodeId}' — canvas '${refNodeId}' not loaded` });
          continue;
        }

        const targetNodes = targetCanvas.data.nodes ?? [];
        if (!targetNodes.some(n => n.id === targetNodeId)) {
          errors.push({ message: `Cross-scope ref '@${refNodeId}/${targetNodeId}' — node '${targetNodeId}' not found in canvas '${refNodeId}'` });
        }
      }
    }
  }
}
```

Update `loadProject()` to call `validateCrossScopeRefs()` instead of `validateRootRefs()`.

- [ ] **Step 1.11: Run all fileResolver tests**

Run: `npx vitest run test/unit/storage/fileResolver.test.ts`
Expected: PASS — update remaining fixtures that use old `ref` format or `@root/`

- [ ] **Step 1.12: Commit**

```bash
git add src/types/schema.ts src/storage/fileResolver.ts test/unit/storage/fileResolver.test.ts test/unit/types/schema.test.ts
git commit -m "feat(i7): cross-scope ref foundation — ref .yaml suffix, map key by node.id, validateCrossScopeRefs"
```

---

### Task 6: Entity Resolver

**Files:**
- Create: `src/core/entity/resolver.ts`
- Test: `test/core/entity/resolver.test.ts`

- [ ] **Step 6.1: Write test — getEntitiesForCanvas basic case**

Create `test/core/entity/resolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getEntitiesForCanvas, findEntityUsages, listAllEntities } from '../../src/core/entity/resolver';
import { ROOT_CANVAS_KEY } from '../../src/storage/fileResolver';

function makeProject(canvases: Record<string, { entities?: any[]; edges?: any[]; nodes?: any[]; displayName?: string }>) {
  const map = new Map<string, any>();
  let root: any = null;

  for (const [id, data] of Object.entries(canvases)) {
    const canvas = { filePath: `.archcanvas/${id}.yaml`, data: { nodes: data.nodes ?? [], edges: data.edges ?? [], entities: data.entities ?? [], displayName: data.displayName ?? id } };
    if (id === ROOT_CANVAS_KEY) {
      root = canvas;
    } else {
      map.set(id, canvas);
    }
  }
  if (!root) root = { filePath: '.archcanvas/main.yaml', data: { nodes: [], edges: [], entities: [], displayName: 'Root' } };
  return { root, canvases: map, errors: [] };
}

describe('getEntitiesForCanvas', () => {
  it('returns entities for a specific canvas', () => {
    const project = makeProject({
      [ROOT_CANVAS_KEY]: { entities: [{ name: 'Order', description: 'A purchase order' }] },
    });
    const entities = getEntitiesForCanvas(project, ROOT_CANVAS_KEY);
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('Order');
  });

  it('returns empty for canvas with no entities', () => {
    const project = makeProject({ [ROOT_CANVAS_KEY]: {} });
    expect(getEntitiesForCanvas(project, ROOT_CANVAS_KEY)).toHaveLength(0);
  });
});
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `npx vitest run test/core/entity/resolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 6.3: Implement getEntitiesForCanvas**

Create `src/core/entity/resolver.ts`:

```typescript
import type { ResolvedProject, LoadedCanvas } from '../../storage/fileResolver';
import type { Edge, Entity } from '../../types/schema';
import { ROOT_CANVAS_KEY } from '../../storage/fileResolver';

export interface EntityUsage {
  canvasId: string;
  canvasDisplayName: string;
  edges: Edge[];
}

export interface EntitySummary {
  name: string;
  description?: string;
  definedIn: string[];
  referencedIn: string[];
}

function getCanvasById(project: ResolvedProject, canvasId: string): LoadedCanvas | undefined {
  if (canvasId === ROOT_CANVAS_KEY) return project.root;
  return project.canvases.get(canvasId);
}

export function getEntitiesForCanvas(project: ResolvedProject, canvasId: string): Entity[] {
  const canvas = getCanvasById(project, canvasId);
  return (canvas?.data.entities ?? []) as Entity[];
}
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `npx vitest run test/core/entity/resolver.test.ts`
Expected: PASS

- [ ] **Step 6.5: Write test — findEntityUsages cross-scope**

```typescript
describe('findEntityUsages', () => {
  it('finds entity usages across multiple canvases', () => {
    const project = makeProject({
      [ROOT_CANVAS_KEY]: {
        entities: [{ name: 'Order' }],
        edges: [{ from: { node: 'a' }, to: { node: 'b' }, entities: ['Order'] }],
      },
      'svc-api': {
        edges: [{ from: { node: 'handler' }, to: { node: 'processor' }, entities: ['Order', 'User'] }],
        displayName: 'API Service',
      },
    });
    const usages = findEntityUsages(project, 'Order');
    expect(usages).toHaveLength(2);
    expect(usages.map(u => u.canvasId)).toContain(ROOT_CANVAS_KEY);
    expect(usages.map(u => u.canvasId)).toContain('svc-api');
  });

  it('returns empty for unused entity', () => {
    const project = makeProject({ [ROOT_CANVAS_KEY]: { entities: [{ name: 'Order' }] } });
    expect(findEntityUsages(project, 'Order')).toHaveLength(0);
  });
});
```

- [ ] **Step 6.6: Implement findEntityUsages**

Add to `src/core/entity/resolver.ts`:

```typescript
function* allCanvases(project: ResolvedProject): Iterable<[string, LoadedCanvas]> {
  yield [ROOT_CANVAS_KEY, project.root];
  for (const [id, canvas] of project.canvases) {
    yield [id, canvas];
  }
}

export function findEntityUsages(project: ResolvedProject, entityName: string): EntityUsage[] {
  const usages: EntityUsage[] = [];
  for (const [canvasId, canvas] of allCanvases(project)) {
    const matchingEdges = (canvas.data.edges ?? []).filter(
      (e: Edge) => e.entities?.includes(entityName),
    );
    if (matchingEdges.length > 0) {
      usages.push({
        canvasId,
        canvasDisplayName: canvas.data.displayName ?? canvasId,
        edges: matchingEdges,
      });
    }
  }
  return usages;
}
```

- [ ] **Step 6.7: Run test**

Run: `npx vitest run test/core/entity/resolver.test.ts`
Expected: PASS

- [ ] **Step 6.8: Write test + implement listAllEntities**

```typescript
describe('listAllEntities', () => {
  it('lists all entities with definition and reference scopes', () => {
    const project = makeProject({
      [ROOT_CANVAS_KEY]: {
        entities: [{ name: 'Order', description: 'A purchase order' }],
        edges: [{ from: { node: 'a' }, to: { node: 'b' }, entities: ['Order'] }],
      },
      'svc-api': {
        entities: [{ name: 'User' }],
        edges: [{ from: { node: 'x' }, to: { node: 'y' }, entities: ['Order'] }],
      },
    });
    const all = listAllEntities(project);
    expect(all).toHaveLength(2);

    const order = all.find(e => e.name === 'Order')!;
    expect(order.definedIn).toEqual([ROOT_CANVAS_KEY]);
    expect(order.referencedIn).toContain(ROOT_CANVAS_KEY);
    expect(order.referencedIn).toContain('svc-api');

    const user = all.find(e => e.name === 'User')!;
    expect(user.definedIn).toEqual(['svc-api']);
    expect(user.referencedIn).toHaveLength(0);
  });
});
```

Implement in `src/core/entity/resolver.ts`:

```typescript
export function listAllEntities(project: ResolvedProject): EntitySummary[] {
  const entityMap = new Map<string, EntitySummary>();

  for (const [canvasId, canvas] of allCanvases(project)) {
    // Collect definitions
    for (const entity of (canvas.data.entities ?? []) as Entity[]) {
      if (!entityMap.has(entity.name)) {
        entityMap.set(entity.name, { name: entity.name, description: entity.description, definedIn: [], referencedIn: [] });
      }
      entityMap.get(entity.name)!.definedIn.push(canvasId);
    }
    // Collect references from edges
    for (const edge of (canvas.data.edges ?? []) as Edge[]) {
      for (const entityName of edge.entities ?? []) {
        if (!entityMap.has(entityName)) {
          entityMap.set(entityName, { name: entityName, definedIn: [], referencedIn: [] });
        }
        const summary = entityMap.get(entityName)!;
        if (!summary.referencedIn.includes(canvasId)) {
          summary.referencedIn.push(canvasId);
        }
      }
    }
  }
  return Array.from(entityMap.values());
}
```

- [ ] **Step 6.9: Run all entity resolver tests**

Run: `npx vitest run test/core/entity/resolver.test.ts`
Expected: PASS

- [ ] **Step 6.10: Commit**

```bash
git add src/core/entity/resolver.ts test/core/entity/resolver.test.ts
git commit -m "feat(i7): entity resolver — findEntityUsages, listAllEntities, getEntitiesForCanvas"
```

---

### Task 9: Bridge Extraction + Standalone Server

**Files:**
- Create: `src/core/ai/bridgeServer.ts`
- Modify: `src/core/ai/vitePlugin.ts`
- Create: `src/bridge/index.ts`
- Create: `vite.config.bridge.ts`
- Modify: `package.json`
- Test: `test/ai/bridgeServer.test.ts`

- [ ] **Step 9.1: Write test — bridgeServer creates and starts**

Create `test/ai/bridgeServer.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { createBridgeServer } from '../../src/core/ai/bridgeServer';

describe('bridgeServer', () => {
  let server: ReturnType<typeof createBridgeServer> | null = null;

  afterEach(async () => {
    if (server) await server.stop();
    server = null;
  });

  it('starts and stops cleanly', async () => {
    server = createBridgeServer({ port: 0, cwd: '/tmp' });
    const { port } = await server.start();
    expect(port).toBeGreaterThan(0);
    await server.stop();
    server = null;
  });

  it('responds to health check', async () => {
    server = createBridgeServer({ port: 0, cwd: '/tmp' });
    const { port } = await server.start();
    const res = await fetch(`http://127.0.0.1:${port}/__archcanvas_ai/api/health`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 9.2: Run test to verify it fails**

Run: `npx vitest run test/ai/bridgeServer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 9.3: Implement bridgeServer.ts — core HTTP + WS server**

Create `src/core/ai/bridgeServer.ts`. Extract route handling and WebSocket logic from `vitePlugin.ts` (lines 37-415) into a standalone module:

```typescript
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

export interface BridgeServerOptions {
  port?: number;
  cwd?: string;
  host?: string;
}

export function createBridgeServer(options: BridgeServerOptions = {}) {
  const { port = 17248, cwd = process.cwd(), host = '127.0.0.1' } = options;
  const httpServer = createServer();
  const wss = new WebSocketServer({ noServer: true });
  let actualPort = port;

  // Extract route handler and WS handler from vitePlugin patterns
  // ... (full extraction from vitePlugin.ts lines 87-403)

  function handleRequest(req: IncomingMessage, res: ServerResponse) {
    // Health check endpoint
    if (req.url === '/__archcanvas_ai/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    // Delegate to extracted route handler
    // ... (move from vitePlugin lines 144-223)
  }

  httpServer.on('request', handleRequest);
  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url === '/__archcanvas_ai') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  // WS connection handler (move from vitePlugin lines 249-403)
  wss.on('connection', (ws: WebSocket) => {
    // ... extracted logic with cwd passed to bridge sessions
  });

  return {
    async start() {
      return new Promise<{ port: number }>((resolve) => {
        httpServer.listen(port, host, () => {
          const addr = httpServer.address();
          actualPort = typeof addr === 'object' && addr ? addr.port : port;
          resolve({ port: actualPort });
        });
      });
    },
    async stop() {
      return new Promise<void>((resolve) => {
        wss.close();
        httpServer.close(() => resolve());
      });
    },
    get httpServer() { return httpServer; },
    get wss() { return wss; },
    handleRequest,
  };
}
```

> **Note to implementer:** The full extraction is ~200 lines. Move the route handling (lines 144-223) and WebSocket connection handling (lines 249-403) from `vitePlugin.ts` into this module. The key change is that `cwd` is passed from options rather than being `process.cwd()`. Keep the unhandled rejection handler (lines 110-125).

- [ ] **Step 9.4: Run test to verify it passes**

Run: `npx vitest run test/ai/bridgeServer.test.ts`
Expected: PASS

- [ ] **Step 9.5: Refactor vitePlugin.ts to delegate to bridgeServer**

Refactor `src/core/ai/vitePlugin.ts` to be a thin wrapper:

```typescript
import { createBridgeServer } from './bridgeServer';

export function aiBridgePlugin(options?: AiBridgePluginOptions): Plugin {
  let bridge: ReturnType<typeof createBridgeServer> | null = null;

  return {
    name: 'archcanvas-ai-bridge',

    configureServer(server) {
      bridge = createBridgeServer({ cwd: process.cwd(), ...options });
      // Attach bridge request handler as Vite middleware
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/__archcanvas_ai/api/')) {
          bridge!.handleRequest(req, res);
        } else {
          next();
        }
      });
      // Attach WebSocket upgrade
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url === '/__archcanvas_ai') {
          bridge!.wss.handleUpgrade(req, socket, head, (ws) => {
            bridge!.wss.emit('connection', ws, req);
          });
        }
      });
    },

    configurePreviewServer(server) {
      // Same pattern for vite preview
      bridge = createBridgeServer({ cwd: process.cwd(), ...options });
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/__archcanvas_ai/api/')) {
          bridge!.handleRequest(req, res);
        } else {
          next();
        }
      });
    },
  };
}
```

- [ ] **Step 9.6: Run existing AI tests to verify no regression**

Run: `npx vitest run test/ai/`
Expected: PASS — all existing bridge/vitePlugin tests still work

- [ ] **Step 9.7: Create standalone bridge entry point**

Create `src/bridge/index.ts`:

```typescript
#!/usr/bin/env node
import { createBridgeServer } from '../core/ai/bridgeServer.js';

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const cwdIdx = args.indexOf('--cwd');

const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 17248;
const cwd = cwdIdx !== -1 ? args[cwdIdx + 1] : process.cwd();

const server = createBridgeServer({ port, cwd });
const { port: actualPort } = await server.start();

// Structured first line for Tauri sidecar port discovery
console.log(`BRIDGE_PORT=${actualPort}`);

process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
```

- [ ] **Step 9.8: Create bridge build config**

Create `vite.config.bridge.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/bridge/index.ts',
      formats: ['es'],
      fileName: () => 'bridge-server.js',
    },
    outDir: 'dist',
    target: 'node20',
    ssr: true,
    rollupOptions: {
      external: [/^node:/, /^@anthropic-ai/, /^ws$/],
    },
  },
});
```

Add to `package.json` scripts:

```json
"build:bridge": "vite build --config vite.config.bridge.ts"
```

- [ ] **Step 9.9: Build and test standalone server**

Run: `npm run build:bridge && node dist/bridge-server.js --port 0 --cwd /tmp`
Expected: Outputs `BRIDGE_PORT=<number>`, server starts. Ctrl+C stops cleanly.

- [ ] **Step 9.10: Commit**

```bash
git add src/core/ai/bridgeServer.ts src/core/ai/vitePlugin.ts src/bridge/index.ts vite.config.bridge.ts package.json test/ai/bridgeServer.test.ts
git commit -m "feat(i7): extract bridge server from vitePlugin, standalone entry point"
```

---

## Chunk 2: Core Logic (Tasks 2, 3, 7)

### Task 2: Engine + Query + Validation

**Files:**
- Modify: `src/core/graph/engine.ts:115-160, 39-57`
- Modify: `src/core/graph/query.ts:63-67`
- Modify: `src/core/graph/validation.ts:108`
- Test: `test/core/graph/engine.test.ts`
- Test: `test/core/graph/query.test.ts`

- [ ] **Step 2.1: Write test — addEdge with @<ref-node-id>/node succeeds**

In `test/core/graph/engine.test.ts`, add:

```typescript
describe('cross-scope @ syntax', () => {
  it('allows edge with @<ref-node-id>/<node-id> when ref-node exists', () => {
    const canvas = {
      nodes: [
        { id: 'svc-api', ref: 'svc-api.yaml' },
        { id: 'db', type: 'data/database' },
      ],
      edges: [],
    };
    const edge = { from: { node: '@svc-api/handler' }, to: { node: 'db' } };
    const result = addEdge(canvas, edge);
    expect(result.ok).toBe(true);
  });

  it('rejects edge with @<nonexistent>/<node-id>', () => {
    const canvas = {
      nodes: [{ id: 'db', type: 'data/database' }],
      edges: [],
    };
    const edge = { from: { node: '@nonexistent/handler' }, to: { node: 'db' } };
    const result = addEdge(canvas, edge);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('CROSS_SCOPE_REF_NOT_FOUND');
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run test/core/graph/engine.test.ts -t "cross-scope @ syntax"`
Expected: FAIL

- [ ] **Step 2.3: Implement — update addEdge for @ syntax**

In `src/core/graph/engine.ts`, in `addEdge()` (around lines 124-134), replace `@root/` handling:

```typescript
// Before: skip @root/ prefixed endpoints
if (!endpoint.node.startsWith('@root/')) {
  if (!nodes.some((n) => n.id === endpoint.node)) { ... }
}

// After: validate @ prefixed endpoints against ref-nodes
if (endpoint.node.startsWith('@')) {
  const slashIdx = endpoint.node.indexOf('/');
  if (slashIdx === -1) {
    return { ok: false, error: { code: 'INVALID_CROSS_SCOPE_REF', message: `Invalid cross-scope ref '${endpoint.node}' — missing /nodeId` } };
  }
  const refNodeId = endpoint.node.slice(1, slashIdx);
  const refNode = nodes.find(n => n.id === refNodeId && 'ref' in n);
  if (!refNode) {
    return { ok: false, error: { code: 'CROSS_SCOPE_REF_NOT_FOUND', message: `Ref-node '${refNodeId}' not found in canvas` } };
  }
} else {
  if (!nodes.some((n) => n.id === endpoint.node)) {
    return { ok: false, error: { code: 'EDGE_ENDPOINT_NOT_FOUND', ... } };
  }
}
```

Update self-loop check (line ~138) — no change needed, raw string comparison still works.

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npx vitest run test/core/graph/engine.test.ts -t "cross-scope @ syntax"`
Expected: PASS

- [ ] **Step 2.5: Write test — removeNode cascades cross-scope edges**

```typescript
it('removeNode cascades edges with @<removed-node-id>/*', () => {
  const canvas = {
    nodes: [
      { id: 'svc-api', ref: 'svc-api.yaml' },
      { id: 'db', type: 'data/database' },
    ],
    edges: [
      { from: { node: '@svc-api/handler' }, to: { node: 'db' } },
      { from: { node: 'db' }, to: { node: 'db' } }, // unrelated edge
    ],
  };
  const result = removeNode(canvas, 'svc-api');
  expect(result.ok).toBe(true);
  expect(result.canvas.edges).toHaveLength(1); // only unrelated edge remains
  expect(result.canvas.nodes).toHaveLength(1); // only db remains
});
```

- [ ] **Step 2.6: Implement — removeNode cascade**

In `src/core/graph/engine.ts`, `removeNode()` (line ~50-53), update edge filter:

```typescript
// Before
edges: draft.edges.filter(e => e.from.node !== nodeId && e.to.node !== nodeId),

// After
edges: draft.edges.filter(e =>
  e.from.node !== nodeId && e.to.node !== nodeId &&
  !e.from.node.startsWith(`@${nodeId}/`) && !e.to.node.startsWith(`@${nodeId}/`)
),
```

- [ ] **Step 2.7: Run test**

Run: `npx vitest run test/core/graph/engine.test.ts -t "removeNode cascades"`
Expected: PASS

- [ ] **Step 2.8: Update matchesNodeId in query.ts**

In `src/core/graph/query.ts` (lines 63-67), replace:

```typescript
// Before
function matchesNodeId(endpoint: string, nodeId: string): boolean {
  if (endpoint === nodeId) return true;
  if (endpoint.startsWith('@root/') && endpoint.slice('@root/'.length) === nodeId) return true;
  return false;
}

// After
function matchesNodeId(endpoint: string, nodeId: string): boolean {
  if (endpoint === nodeId) return true;
  // Match @<ref-node-id>/<nodeId> — the nodeId after the slash
  if (endpoint.startsWith('@')) {
    const slashIdx = endpoint.indexOf('/');
    if (slashIdx !== -1 && endpoint.slice(slashIdx + 1) === nodeId) return true;
  }
  return false;
}
```

- [ ] **Step 2.9: Update validation.ts skip logic**

In `src/core/graph/validation.ts` (line 108), replace:

```typescript
// Before
if (endpoint.node.startsWith('@root/')) continue;

// After
if (endpoint.node.startsWith('@')) continue;
```

- [ ] **Step 2.10: Run all engine, query, validation tests**

Run: `npx vitest run test/core/graph/`
Expected: PASS (update remaining `@root/` fixtures in test files)

- [ ] **Step 2.11: Commit**

```bash
git add src/core/graph/engine.ts src/core/graph/query.ts src/core/graph/validation.ts test/core/graph/
git commit -m "feat(i7): engine @ cross-scope syntax, removeNode cascade, query/validation updates"
```

---

### Task 3: Inherited Edges UI

**Files:**
- Modify: `src/components/canvas/hooks/useCanvasRenderer.ts`
- Modify: `src/components/edges/EdgeRenderer.tsx`
- Modify: `src/components/edges/EdgeRenderer.css`
- Modify: `src/store/navigationStore.ts`
- Modify: `src/core/layout/elk.ts`
- Test: `test/e2e/canvas-operations.spec.ts`

- [ ] **Step 3.1: Write unit test — inherited edge extraction logic**

Create `test/components/canvas/inheritedEdges.test.ts` to test the pure logic of extracting inherited edges from parent edges (before integrating into React hook):

```typescript
import { describe, it, expect } from 'vitest';
import { extractInheritedEdges } from '../../../src/components/canvas/inheritedEdges';

describe('extractInheritedEdges', () => {
  it('extracts edges targeting the current subsystem', () => {
    const parentEdges = [
      { from: { node: '@svc-api/handler' }, to: { node: 'db' }, label: 'persist' },
      { from: { node: 'a' }, to: { node: 'b' } }, // unrelated
    ];
    const result = extractInheritedEdges(parentEdges, 'svc-api');
    expect(result).toHaveLength(1);
    expect(result[0].localEndpoint).toBe('handler');
    expect(result[0].ghostEndpoint).toBe('db');
    expect(result[0].edge.label).toBe('persist');
  });

  it('returns empty when no edges match', () => {
    const parentEdges = [{ from: { node: 'a' }, to: { node: 'b' } }];
    expect(extractInheritedEdges(parentEdges, 'svc-api')).toHaveLength(0);
  });

  it('handles both from and to as cross-scope', () => {
    const parentEdges = [
      { from: { node: 'db' }, to: { node: '@svc-api/processor' } },
    ];
    const result = extractInheritedEdges(parentEdges, 'svc-api');
    expect(result).toHaveLength(1);
    expect(result[0].localEndpoint).toBe('processor');
    expect(result[0].ghostEndpoint).toBe('db');
  });
});
```

- [ ] **Step 3.2: Implement extractInheritedEdges pure function**

Create `src/components/canvas/inheritedEdges.ts` — pure function, no React:

```typescript
import type { Edge } from '../../types/schema';

export interface InheritedEdge {
  edge: Edge;
  localEndpoint: string;
  ghostEndpoint: string;
  direction: 'inbound' | 'outbound'; // relative to the child canvas
}

export function extractInheritedEdges(parentEdges: Edge[], refNodeId: string): InheritedEdge[] {
  const prefix = `@${refNodeId}/`;
  const results: InheritedEdge[] = [];

  for (const edge of parentEdges) {
    const fromIsLocal = edge.from.node.startsWith(prefix);
    const toIsLocal = edge.to.node.startsWith(prefix);
    if (!fromIsLocal && !toIsLocal) continue;

    results.push({
      edge,
      localEndpoint: fromIsLocal ? edge.from.node.slice(prefix.length) : edge.to.node.slice(prefix.length),
      ghostEndpoint: fromIsLocal ? edge.to.node : edge.from.node,
      direction: toIsLocal ? 'inbound' : 'outbound',
    });
  }
  return results;
}
```

- [ ] **Step 3.3: Run test to verify it passes**

Run: `npx vitest run test/components/canvas/inheritedEdges.test.ts`
Expected: PASS

- [ ] **Step 3.4: Update navigationStore — store parent context**

In `src/store/navigationStore.ts`, add to state interface:

```typescript
interface NavigationStoreState {
  // ...existing fields...
  parentCanvasId: string | null;
  parentEdges: Edge[];
}
```

In `diveIn()`, line 41: change `const targetCanvasId = node.ref` to `const targetCanvasId = refNodeId`. Store parent context:

```typescript
set({
  currentCanvasId: targetCanvasId,
  parentCanvasId: get().currentCanvasId,
  parentEdges: canvas?.data.edges ?? [],
  breadcrumb: [...get().breadcrumb, { canvasId: targetCanvasId, displayName }],
});
```

In `goUp()`, `goToRoot()`, etc.: clear or update `parentCanvasId` and `parentEdges` appropriately.

- [ ] **Step 3.2: Implement inherited edge injection in useCanvasRenderer**

In `src/components/canvas/hooks/useCanvasRenderer.ts`, after the existing edges memo, add inherited edge computation:

```typescript
const inheritedEdges = useMemo(() => {
  const { parentCanvasId, parentEdges, currentCanvasId } = useNavigationStore.getState();
  if (!parentCanvasId || !parentEdges.length) return [];

  // Find the ref-node-id that maps to current canvas
  const parentCanvas = useFileStore.getState().getCanvas(parentCanvasId);
  const refNodeId = parentCanvas?.data.nodes?.find(
    n => 'ref' in n && n.id === currentCanvasId
  )?.id;
  if (!refNodeId) return [];

  const prefix = `@${refNodeId}/`;
  return parentEdges
    .filter(e => e.from.node.startsWith(prefix) || e.to.node.startsWith(prefix))
    .map(e => ({
      ...e,
      // Strip prefix from the local endpoint, mark other as ghost
      from: { ...e.from, node: e.from.node.startsWith(prefix) ? e.from.node.slice(prefix.length) : `__ghost__${e.from.node}` },
      to: { ...e.to, node: e.to.node.startsWith(prefix) ? e.to.node.slice(prefix.length) : `__ghost__${e.to.node}` },
      _inherited: true,
      _parentScopeLabel: parentCanvas?.data.displayName ?? parentCanvasId,
    }));
}, [navigationStore.currentCanvasId]);
```

Create ghost node entries for non-local endpoints (nodes with `__ghost__` prefix). Add them to the ReactFlow nodes list with ghost styling.

- [ ] **Step 3.3: Update EdgeRenderer for inherited edges**

In `src/components/edges/EdgeRenderer.tsx`, replace the `@root/` ghost marker logic (lines 30-45):

```typescript
const isInherited = edge?.data?.inherited === true;

// Replace @root/ ghost markers with inherited edge styling
return (
  <>
    <path
      id={id}
      className={`react-flow__edge-path edge-${styleCategory}${isInherited ? ' edge-inherited' : ''}`}
      d={edgePath}
      markerEnd={isInherited ? undefined : markerEnd}
    />
    {/* ... label rendering ... */}
  </>
);
```

- [ ] **Step 3.4: Add CSS for inherited edges and ghost nodes**

In `src/components/edges/EdgeRenderer.css`:

```css
/* Inherited edges from parent scope */
.edge-inherited {
  stroke-dasharray: 6, 4;
  opacity: 0.6;
}

/* Ghost node placeholder for non-local endpoints */
.ghost-node {
  border: 2px dashed var(--color-border-muted, #6b7280);
  background: var(--color-bg-muted, #f3f4f6);
  opacity: 0.5;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--color-text-muted, #9ca3af);
}
```

- [ ] **Step 3.5: Update ELK layout to include ghost nodes**

In `src/core/layout/elk.ts`, when building the ELK graph, include ghost nodes as fixed-size entries (150x40). They participate in layout but are visually distinct.

- [ ] **Step 3.6: Run unit tests**

Run: `npx vitest run test/store/navigationStore.test.ts`
Expected: PASS (update fixtures)

- [ ] **Step 3.7: Write E2E test for inherited edges**

In `test/e2e/canvas-operations.spec.ts`:

```typescript
test('shows inherited edges when diving into subsystem', async ({ page }) => {
  // Setup: project with cross-scope edge in parent
  // Dive into subsystem
  // Verify inherited edge is visible with ghost styling
  // Verify ghost node placeholder exists
  // Go back to parent — inherited edges disappear
});
```

- [ ] **Step 3.8: Run E2E tests**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 3.9: Commit**

```bash
git add src/components/canvas/hooks/useCanvasRenderer.ts src/components/edges/EdgeRenderer.tsx src/components/edges/EdgeRenderer.css src/store/navigationStore.ts src/core/layout/elk.ts test/
git commit -m "feat(i7): inherited edges — ghost nodes, dashed rendering, parent context in navigation"
```

---

### Task 7: EntityPanel UI

**Files:**
- Create: `src/components/panels/EntityPanel.tsx`
- Modify: `src/components/layout/RightPanel.tsx`
- Modify: `src/store/uiStore.ts`
- Test: `test/components/panels/EntityPanel.test.ts`

- [ ] **Step 7.1: Expand uiStore rightPanelMode**

In `src/store/uiStore.ts`, line 6:

```typescript
// Before
rightPanelMode: 'details' | 'chat';

// After
rightPanelMode: 'details' | 'chat' | 'entities';
```

- [ ] **Step 7.2: Create EntityPanel component**

Create `src/components/panels/EntityPanel.tsx`:

```typescript
import { useState, useMemo } from 'react';
import { useFileStore } from '../../store/fileStore';
import { useNavigationStore } from '../../store/navigationStore';
import { getEntitiesForCanvas, findEntityUsages } from '../../core/entity/resolver';

export function EntityPanel() {
  const [filter, setFilter] = useState('');
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const project = useFileStore(s => s.project);
  const currentCanvasId = useNavigationStore(s => s.currentCanvasId);

  const entities = useMemo(() => {
    if (!project) return [];
    return getEntitiesForCanvas(project, currentCanvasId);
  }, [project, currentCanvasId]);

  const filtered = useMemo(() => {
    if (!filter) return entities;
    return entities.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()));
  }, [entities, filter]);

  if (!project) return <div className="p-4 text-sm text-gray-500">No project loaded</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold mb-2">Entities</h3>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter entities..."
          className="w-full px-2 py-1 text-sm border rounded"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No entities in this scope</div>
        ) : (
          filtered.map(entity => (
            <EntityRow
              key={entity.name}
              entity={entity}
              project={project}
              expanded={expandedEntity === entity.name}
              onToggle={() => setExpandedEntity(expandedEntity === entity.name ? null : entity.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

> **Note to implementer:** Add `EntityRow` sub-component with expandable detail showing cross-scope usages via `findEntityUsages()`. Follow existing panel patterns from `NodeDetailPanel.tsx`.

- [ ] **Step 7.3: Integrate into RightPanel**

In `src/components/layout/RightPanel.tsx`, add the entities case:

```typescript
import { EntityPanel } from '../panels/EntityPanel';

// In the render, add:
{rightPanelMode === 'entities' && <EntityPanel />}
```

Add a tab/button for switching to entities mode.

- [ ] **Step 7.4: Write tests**

Create `test/components/panels/EntityPanel.test.ts` with rendering tests.

- [ ] **Step 7.5: Run tests**

Run: `npx vitest run test/components/panels/`
Expected: PASS

- [ ] **Step 7.6: Commit**

```bash
git add src/components/panels/EntityPanel.tsx src/components/layout/RightPanel.tsx src/store/uiStore.ts test/components/panels/EntityPanel.test.ts
git commit -m "feat(i7): EntityPanel — browse entities in current scope, expandable detail"
```

---

## Chunk 3: Integration (Tasks 4, 5, 8)

### Task 4: @root/ Cleanup Sweep

**Files:** Multiple (see task file for full list)

- [ ] **Step 4.1: Find all remaining @root/ references**

Run: `grep -rn "@root/" src/ test/ --include='*.ts' --include='*.tsx'`

- [ ] **Step 4.2: Update NodeRenderer.tsx**

Change `getCanvas(node.ref)` to use the node's `id` for canvas lookup (since map is now keyed by ref-node `id`):

```typescript
// Before (line 17)
const refCanvas = useFileStore.getState().getCanvas(node.ref);

// After
const refCanvas = useFileStore.getState().getCanvas(node.id);
```

- [ ] **Step 4.3: Update webSocketProvider.ts**

Update all `canvases.get(ref)` calls (line ~476) to use `node.id`:

```typescript
// Before
const ref = 'ref' in n ? n.ref : '';
const childCanvas = project.canvases.get(ref);

// After
const childCanvas = project.canvases.get(n.id);
```

- [ ] **Step 4.4: Update systemPrompt.ts**

Replace `@root/` examples with new `@<ref-node-id>/` syntax.

- [ ] **Step 4.5: Update CLI commands**

Update help text and output formatting in `describe.ts`, `list.ts`, `search.ts`, `add-edge.ts`.

- [ ] **Step 4.6: Update all test fixtures**

Replace all `@root/` references in test files with new syntax. Replace bare `ref:` values with `.yaml` suffixed values.

- [ ] **Step 4.7: Verify no @root/ references remain**

Run: `grep -rn "@root/" src/ test/ --include='*.ts' --include='*.tsx'`
Expected: Zero results

- [ ] **Step 4.8: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4.9: Commit**

```bash
git add -A
git commit -m "refactor(i7): remove all @root/ references — complete migration to @<ref-node-id>/ syntax"
```

---

### Task 5: Protocol Compatibility

**Files:**
- Create: `src/core/protocol/compatibility.ts`
- Modify: `src/core/graph/engine.ts`
- Modify: `src/cli/commands/add-edge.ts`
- Test: `test/core/protocol/compatibility.test.ts`

- [ ] **Step 5.1: Write test — arePortsCompatible**

Create `test/core/protocol/compatibility.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { arePortsCompatible } from '../../src/core/protocol/compatibility';

describe('arePortsCompatible', () => {
  it('compatible when protocols overlap', () => {
    const result = arePortsCompatible(
      { name: 'http-out', direction: 'outbound', protocol: ['HTTP', 'HTTPS'] },
      { name: 'http-in', direction: 'inbound', protocol: ['HTTP', 'gRPC'] },
    );
    expect(result.compatible).toBe(true);
  });

  it('incompatible when no overlap', () => {
    const result = arePortsCompatible(
      { name: 'http-out', direction: 'outbound', protocol: ['HTTP', 'HTTPS'] },
      { name: 'query-in', direction: 'inbound', protocol: ['SQL'] },
    );
    expect(result.compatible).toBe(false);
    expect(result.fromPortName).toBe('http-out');
    expect(result.toPortName).toBe('query-in');
  });

  it('compatible when either port undefined', () => {
    expect(arePortsCompatible(undefined, { name: 'x', direction: 'inbound', protocol: ['SQL'] }).compatible).toBe(true);
    expect(arePortsCompatible({ name: 'x', direction: 'outbound', protocol: ['HTTP'] }, undefined).compatible).toBe(true);
  });

  it('compatible when protocol array empty', () => {
    expect(arePortsCompatible(
      { name: 'x', direction: 'outbound', protocol: [] },
      { name: 'y', direction: 'inbound', protocol: ['SQL'] },
    ).compatible).toBe(true);
  });

  it('same protocol always compatible', () => {
    expect(arePortsCompatible(
      { name: 'a', direction: 'outbound', protocol: ['SQL'] },
      { name: 'b', direction: 'inbound', protocol: ['SQL'] },
    ).compatible).toBe(true);
  });
});
```

- [ ] **Step 5.2: Implement arePortsCompatible**

Create `src/core/protocol/compatibility.ts`:

```typescript
import type { PortDef } from '../../types/nodeDefSchema';

export interface ProtocolCheckResult {
  compatible: boolean;
  fromPortName?: string;
  fromProtocols?: string[];
  toPortName?: string;
  toProtocols?: string[];
}

export function arePortsCompatible(
  fromPort: PortDef | undefined,
  toPort: PortDef | undefined,
): ProtocolCheckResult {
  if (!fromPort || !toPort) return { compatible: true };
  if (!fromPort.protocol?.length || !toPort.protocol?.length) return { compatible: true };

  const compatible = fromPort.protocol.some(p => toPort.protocol!.includes(p));
  return {
    compatible,
    fromPortName: fromPort.name,
    fromProtocols: fromPort.protocol,
    toPortName: toPort.name,
    toProtocols: toPort.protocol,
  };
}
```

- [ ] **Step 5.3: Run test**

Run: `npx vitest run test/core/protocol/compatibility.test.ts`
Expected: PASS

- [ ] **Step 5.4: Integrate into engine addEdge**

In `src/core/graph/engine.ts`, after endpoint validation in `addEdge()`, add protocol check:

```typescript
// After endpoint validation, before duplicate check:
if (edge.from.port && edge.to.port && registry) {
  const fromNode = nodes.find(n => n.id === (edge.from.node.startsWith('@') ? edge.from.node : edge.from.node));
  // Resolve NodeDef and find port definitions...
  const result = arePortsCompatible(fromPortDef, toPortDef);
  if (!result.compatible) {
    return {
      ok: false,
      error: {
        code: 'PROTOCOL_MISMATCH',
        message: `${result.fromPortName} accepts [${result.fromProtocols?.join(', ')}], ${result.toPortName} accepts [${result.toProtocols?.join(', ')}] — no common protocol`,
      },
    };
  }
}
```

- [ ] **Step 5.5: Write engine integration test**

```typescript
it('rejects edge when port protocols are incompatible', () => {
  // Setup: canvas with nodes that have NodeDefs with incompatible ports
  // Call addEdge with ports specified
  // Expect PROTOCOL_MISMATCH error
});
```

- [ ] **Step 5.6: Run all tests**

Run: `npx vitest run test/core/`
Expected: PASS

- [ ] **Step 5.7: Commit**

```bash
git add src/core/protocol/compatibility.ts src/core/graph/engine.ts test/core/protocol/
git commit -m "feat(i7): protocol compatibility — reject edges with incompatible port protocols"
```

---

### Task 8: Entity Integration

**Files:**
- Modify: `src/components/shared/CommandPalette.tsx`
- Modify: `src/store/canvasStore.ts`
- Modify: `src/components/edges/EdgeRenderer.tsx`
- Modify: `src/components/edges/EdgeRenderer.css`
- Modify: `src/store/uiStore.ts`
- Modify: `src/components/panels/NodeDetailPanel.tsx`
- Test: `test/store/canvasStore.test.ts`

- [ ] **Step 8.1: Add highlightEdges to canvasStore**

In `src/store/canvasStore.ts`, add to state:

```typescript
highlightedEdgeIds: [] as string[],
highlightEdges: (edgeIds: string[]) => set({ highlightedEdgeIds: edgeIds }),
clearHighlight: () => set({ highlightedEdgeIds: [] }),
```

- [ ] **Step 8.2: Add highlight CSS to EdgeRenderer**

In `src/components/edges/EdgeRenderer.tsx`, add highlight check:

```typescript
const highlightedEdgeIds = useCanvasStore(s => s.highlightedEdgeIds);
const isHighlighted = highlightedEdgeIds.includes(id);

// Add to path className:
className={`...${isHighlighted ? ' edge-highlighted' : ''}`}
```

In `src/components/edges/EdgeRenderer.css`:

```css
.edge-highlighted {
  stroke-width: 3px;
  filter: drop-shadow(0 0 4px var(--color-accent, #3b82f6));
}
```

- [ ] **Step 8.3: Add entity provider to CommandPalette**

In `src/components/shared/CommandPalette.tsx`, add entity provider for `# ` prefix following the existing provider pattern.

- [ ] **Step 8.4: Add tab-switch API to uiStore**

In `src/store/uiStore.ts`:

```typescript
detailPanelTab: null as 'properties' | 'notes' | 'codeRefs' | null,
setDetailPanelTab: (tab: 'properties' | 'notes' | 'codeRefs' | null) => set({ detailPanelTab: tab }),
```

In `src/components/panels/NodeDetailPanel.tsx`, subscribe to `detailPanelTab`.

- [ ] **Step 8.5: Write tests**

Test `highlightEdges` in `canvasStore.test.ts`, test `# ` prefix in CommandPalette tests.

- [ ] **Step 8.6: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8.7: Commit**

```bash
git add src/components/shared/CommandPalette.tsx src/store/canvasStore.ts src/components/edges/EdgeRenderer.tsx src/components/edges/EdgeRenderer.css src/store/uiStore.ts src/components/panels/NodeDetailPanel.tsx test/
git commit -m "feat(i7): entity integration — command palette #, edge highlight, tab-switch API"
```

---

## Chunk 4: Packaging (Task 10)

### Task 10: Tauri Sidecar + Packaging

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/main.rs`
- Modify: `package.json`
- Modify: `src/core/ai/webSocketProvider.ts`

- [ ] **Step 10.1: Risk gate — test bun build --compile**

Run: `npm run build:bridge && bun build --compile dist/bridge-server.js --outfile /tmp/archcanvas-bridge-test`

If it fails: document the error and implement the Node.js fallback (ship `dist/bridge-server.js` as script sidecar). If it succeeds: proceed with binary sidecar.

- [ ] **Step 10.2: Add build:sidecar script**

In `package.json`:

```json
"build:sidecar": "bun build --compile dist/bridge-server.js --outfile src-tauri/binaries/archcanvas-bridge-aarch64-apple-darwin"
```

- [ ] **Step 10.3: Configure Tauri sidecar**

In `src-tauri/tauri.conf.json`, add:

```json
{
  "bundle": {
    "externalBin": ["binaries/archcanvas-bridge"]
  }
}
```

- [ ] **Step 10.4: Implement Rust sidecar management**

In `src-tauri/src/main.rs`:

```rust
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::sync::Mutex;

struct BridgePort(Mutex<Option<u16>>);

#[tauri::command]
fn get_bridge_port(state: tauri::State<BridgePort>) -> Result<u16, String> {
    state.0.lock().unwrap().ok_or_else(|| "Bridge not started".into())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BridgePort(Mutex::new(None)))
        .setup(|app| {
            let sidecar = app.shell().sidecar("archcanvas-bridge")
                .expect("failed to create sidecar");
            let (mut rx, _child) = sidecar.args(["--port", "0"]).spawn()
                .expect("failed to spawn sidecar");

            let state = app.state::<BridgePort>().clone();
            // Read first line for BRIDGE_PORT=<port>
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line) = &event {
                        let line = String::from_utf8_lossy(line);
                        if let Some(port_str) = line.strip_prefix("BRIDGE_PORT=") {
                            if let Ok(port) = port_str.trim().parse::<u16>() {
                                *state.0.lock().unwrap() = Some(port);
                                break;
                            }
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_bridge_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> **Note:** This uses the Tauri 2.0 `tauri-plugin-shell` API. The `CommandEvent::Stdout` variant contains `Vec<u8>` in Tauri 2.0, so we use `String::from_utf8_lossy`. Ensure `tauri-plugin-shell` is listed in `Cargo.toml` dependencies (it already is).

- [ ] **Step 10.5: Add frontend port discovery**

In `src/core/ai/webSocketProvider.ts`, add port resolution:

```typescript
async function resolveBridgePort(): Promise<number> {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<number>('get_bridge_port');
  }
  return parseInt(import.meta.env.VITE_BRIDGE_PORT ?? '17248');
}
```

Use this in the WebSocket connection setup.

- [ ] **Step 10.6: Install @tauri-apps/plugin-fs**

Run: `npm install @tauri-apps/plugin-fs`

Remove custom `.d.ts` workaround file if it exists.

- [ ] **Step 10.7: Build and test**

Run:
```bash
npm run build
npm run build:bridge
npm run build:sidecar
npm run tauri build
```

Expected: `.dmg` produced in `src-tauri/target/release/bundle/dmg/`

- [ ] **Step 10.8: Manual smoke test**

1. Open the `.dmg`, install the app
2. Launch ArchCanvas
3. Verify AI chat connects (sidecar started)
4. Create a project, add nodes, test canvas
5. Verify save/open works

- [ ] **Step 10.9: Commit**

```bash
git add src-tauri/ src/core/ai/webSocketProvider.ts package.json package-lock.json
git commit -m "feat(i7): Tauri sidecar + desktop packaging — compiled bridge binary, .dmg build"
```

---

## Final Verification

After all 10 tasks are complete:

- [ ] **Run full unit test suite**: `npx vitest run` — expect ALL PASS
- [ ] **Run full E2E suite**: `npm run test:e2e` — expect ALL PASS
- [ ] **Run linter**: `npm run lint` — expect no errors
- [ ] **Run typecheck**: `npm run typecheck` — expect no errors
- [ ] **Verify zero @root/ references**: `grep -rn "@root/" src/ test/` — expect zero results
- [ ] **Build all targets**: `npm run build && npm run build:cli && npm run build:bridge`
- [ ] **Tauri build**: `npm run tauri build` — expect .dmg
