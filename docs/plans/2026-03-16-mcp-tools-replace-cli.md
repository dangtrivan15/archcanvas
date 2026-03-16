# MCP Tools Replace CLI — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 9 CLI commands with in-process MCP tools on the sidecar so the AI can create nodes/edges in both web and desktop mode without requiring the `archcanvas` CLI binary.

**Architecture:** Define 9 MCP tools via `createSdkMcpServer()` + `tool()` in the sidecar entry. Each handler translates MCP args to dispatcher shape, then calls `server.relayStoreAction()` — a new method on the bridge server that extracts the existing HTTP→WebSocket relay into a reusable function. All tools are auto-approved via `allowedTools`.

**Tech Stack:** Claude Agent SDK (`createSdkMcpServer`, `tool`), Zod (tool input schemas), existing bridge WebSocket relay

**Spec:** `docs/specs/2026-03-16-mcp-tools-replace-cli-design.md`

---

## Chunk 1: Bridge Relay Extraction + MCP Server

### Task 1: Add `relayStoreAction` method to bridge server

**Files:**
- Modify: `src/core/ai/bridgeServer.ts`
- Test: `test/ai/bridgeServer.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test to `test/ai/bridgeServer.test.ts` that creates a bridge server, connects a mock browser WebSocket, and calls `server.relayStoreAction('list', {})`. Expect it to return a `StoreActionResult`.

```typescript
it('relayStoreAction relays to browser and returns result', async () => {
  const server = createBridgeServer({ port: 0 });
  const { port } = await server.start();

  // Connect a mock browser client that auto-responds to store_action
  const ws = new WebSocket(`ws://127.0.0.1:${port}/__archcanvas_ai`);
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'store_action') {
      ws.send(JSON.stringify({
        type: 'store_action_result',
        correlationId: msg.correlationId,
        ok: true,
        data: { items: [] },
      }));
    }
  });

  const result = await server.relayStoreAction('list', {});
  expect(result.ok).toBe(true);
  expect(result.data).toEqual({ items: [] });

  ws.close();
  await server.stop();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit test/ai/bridgeServer.test.ts`
Expected: FAIL — `server.relayStoreAction is not a function`

- [ ] **Step 3: Implement `relayStoreAction`**

In `bridgeServer.ts`, extract the relay logic from `handleRequest` into a new `relayStoreAction` method. Add it to the returned object alongside `handleRequest`, `handleConnection`, `start`, `stop`.

```typescript
async relayStoreAction(
  action: string,
  args: Record<string, unknown>,
): Promise<StoreActionResult> {
  const client = findActiveBrowserClient();
  if (!client) {
    return {
      type: 'store_action_result',
      correlationId: '',
      ok: false,
      error: { code: 'BRIDGE_DISCONNECTED', message: 'No browser client connected' },
    };
  }

  const correlationId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storeAction: StoreActionMessage = { type: 'store_action', action, args, correlationId };

  try {
    client.send(JSON.stringify(storeAction));
  } catch {
    return {
      type: 'store_action_result',
      correlationId,
      ok: false,
      error: { code: 'BRIDGE_DISCONNECTED', message: 'Failed to send to browser' },
    };
  }

  const timeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  return new Promise<StoreActionResult>((resolve) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(correlationId);
      resolve({
        type: 'store_action_result',
        correlationId,
        ok: false,
        error: { code: 'BRIDGE_TIMEOUT', message: 'Browser did not respond in time' },
      });
    }, timeoutMs);

    pendingRequests.set(correlationId, {
      resolve: (result) => {
        clearTimeout(timer);
        pendingRequests.delete(correlationId);
        resolve(result);
      },
      timer,
    });
  });
},
```

Also add a test for the no-client case:

```typescript
it('relayStoreAction returns error when no browser connected', async () => {
  const server = createBridgeServer({ port: 0 });
  const { port } = await server.start();

  const result = await server.relayStoreAction('list', {});
  expect(result.ok).toBe(false);
  expect(result.error?.code).toBe('BRIDGE_DISCONNECTED');

  await server.stop();
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project unit test/ai/bridgeServer.test.ts`
Expected: PASS

- [ ] **Step 5: Refactor `handleRequest` to use `relayStoreAction`**

Replace the inline relay logic in `handleRequest` with a call to `relayStoreAction`. The HTTP handler becomes thin: parse body → `relayStoreAction(action, args)` → write HTTP response from result.

- [ ] **Step 6: Run all bridge tests**

Run: `npx vitest run --project unit test/ai/`
Expected: All pass

- [ ] **Step 7: Commit**

```
feat: extract relayStoreAction from bridge server for MCP tool reuse
```

---

### Task 2: Define MCP tools and wire into sidecar

**Files:**
- Modify: `src/bridge/index.ts`
- Reference: `src/storage/yamlCodec.ts` (for import handler)

- [ ] **Step 1: Add MCP tool definitions**

In `src/bridge/index.ts`, after creating the bridge server, define the MCP server using `createSdkMcpServer` + `tool` from the SDK. Import `z` from `zod`.

Define all 9 tools. Each write tool translates args before relay. Example for `add_node`:

```typescript
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// After: const server = createBridgeServer(...)

const ROOT = '__root__'; // ROOT_CANVAS_KEY from types

const mcpServer = createSdkMcpServer({
  name: 'archcanvas',
  version: '0.1.0',
  tools: [
    tool('add_node', 'Add a node to the architecture canvas', {
      id: z.string().describe('Unique node identifier (kebab-case)'),
      type: z.string().describe('Node type (e.g., compute/service, data/database). Run catalog tool first.'),
      name: z.string().optional().describe('Display name'),
      args: z.string().optional().describe('Constructor arguments as JSON string'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }, async (a) => {
      const result = await server.relayStoreAction('addNode', {
        canvasId: a.scope ?? ROOT,
        id: a.id, type: a.type, name: a.name, args: a.args,
      });
      return toCallToolResult(result);
    }),

    tool('add_edge', 'Add an edge (connection) between two nodes', {
      from: z.string().describe('Source node ID (use @refNodeId/nodeId for cross-scope)'),
      to: z.string().describe('Target node ID'),
      fromPort: z.string().optional().describe('Source port name'),
      toPort: z.string().optional().describe('Target port name'),
      protocol: z.string().optional().describe('Communication protocol (HTTP, gRPC, SQL, etc.)'),
      label: z.string().optional().describe('Edge label'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }, async (a) => {
      const edge = {
        from: { node: a.from, ...(a.fromPort ? { port: a.fromPort } : {}) },
        to: { node: a.to, ...(a.toPort ? { port: a.toPort } : {}) },
        ...(a.protocol ? { protocol: a.protocol } : {}),
        ...(a.label ? { label: a.label } : {}),
      };
      const result = await server.relayStoreAction('addEdge', {
        canvasId: a.scope ?? ROOT, edge,
      });
      return toCallToolResult(result);
    }),

    tool('remove_node', 'Remove a node from the canvas', {
      id: z.string().describe('Node ID to remove'),
      scope: z.string().optional(),
    }, async (a) => {
      const result = await server.relayStoreAction('removeNode', {
        canvasId: a.scope ?? ROOT, nodeId: a.id,
      });
      return toCallToolResult(result);
    }),

    tool('remove_edge', 'Remove an edge between two nodes', {
      from: z.string().describe('Source node ID'),
      to: z.string().describe('Target node ID'),
      scope: z.string().optional(),
    }, async (a) => {
      const result = await server.relayStoreAction('removeEdge', {
        canvasId: a.scope ?? ROOT, from: a.from, to: a.to,
      });
      return toCallToolResult(result);
    }),

    tool('import_yaml', 'Import nodes, edges, and entities from YAML content', {
      yaml: z.string().describe('YAML content to import'),
      scope: z.string().optional(),
    }, async (a) => {
      // Parse YAML to extract nodes/edges/entities — dispatcher expects pre-parsed arrays
      let parsed;
      try {
        const { parseCanvas } = await import('../storage/yamlCodec.js');
        parsed = parseCanvas(a.yaml);
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `YAML parse error: ${err.message}` }], isError: true };
      }
      const result = await server.relayStoreAction('import', {
        canvasId: a.scope ?? ROOT,
        nodes: parsed.data.nodes ?? [],
        edges: parsed.data.edges ?? [],
        entities: parsed.data.entities ?? [],
      });
      return toCallToolResult(result);
    }),

    // Read tools — pass args directly (dispatcher expects these shapes)
    tool('list', 'List nodes, edges, or entities in a canvas', {
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      type: z.enum(['nodes', 'edges', 'entities', 'all']).optional().describe('What to list'),
    }, async (a) => {
      const result = await server.relayStoreAction('list', {
        canvasId: a.scope ?? ROOT, type: a.type,
      });
      return toCallToolResult(result);
    }),

    tool('describe', 'Describe a node or the full architecture', {
      id: z.string().optional().describe('Node ID (omit for full architecture overview)'),
      scope: z.string().optional(),
    }, async (a) => {
      const result = await server.relayStoreAction('describe', {
        canvasId: a.scope ?? ROOT, ...(a.id ? { id: a.id } : {}),
      });
      return toCallToolResult(result);
    }),

    tool('search', 'Search for nodes, edges, or entities by query', {
      query: z.string().describe('Search query'),
      type: z.enum(['nodes', 'edges', 'entities']).optional(),
    }, async (a) => {
      const result = await server.relayStoreAction('search', {
        query: a.query, ...(a.type ? { type: a.type } : {}),
      });
      return toCallToolResult(result);
    }),

    tool('catalog', 'List available node types from the registry', {
      namespace: z.string().optional().describe('Filter by namespace (e.g., compute, data)'),
    }, async (a) => {
      const result = await server.relayStoreAction('catalog', {
        ...(a.namespace ? { namespace: a.namespace } : {}),
      });
      return toCallToolResult(result);
    }),
  ],
});

function toCallToolResult(result: any) {
  if (result.ok) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(result.error) }], isError: true };
}
```

- [ ] **Step 2: Pass MCP server to wrappedQuery**

Update `wrappedQuery` to include `mcpServers` and `allowedTools`:

```typescript
const MCP_TOOL_NAMES = [
  'mcp__archcanvas__add_node', 'mcp__archcanvas__add_edge',
  'mcp__archcanvas__remove_node', 'mcp__archcanvas__remove_edge',
  'mcp__archcanvas__import_yaml', 'mcp__archcanvas__list',
  'mcp__archcanvas__describe', 'mcp__archcanvas__search',
  'mcp__archcanvas__catalog',
];

const wrappedQuery: typeof query = ({ prompt, options }) =>
  query({
    prompt,
    options: {
      ...options,
      ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
      mcpServers: { archcanvas: mcpServer },
      allowedTools: [...(options?.allowedTools ?? []), ...MCP_TOOL_NAMES],
    },
  });
```

- [ ] **Step 3: Build sidecar and smoke test**

Run: `export PATH="$HOME/.bun/bin:$PATH" && npm run build:sidecar`
Then start sidecar manually and verify health + MCP tools are registered.

- [ ] **Step 4: Commit**

```
feat: define 9 MCP tools in sidecar with bridge relay
```

---

## Chunk 2: SDK Integration + System Prompt

### Task 3: Wire MCP servers through claudeCodeBridge

**Files:**
- Modify: `src/core/ai/claudeCodeBridge.ts`
- Modify: `src/core/ai/bridgeServer.ts` (BridgeServerOptions)

- [ ] **Step 1: Add mcpServers to BridgeSessionOptions**

In `claudeCodeBridge.ts`, add to `BridgeSessionOptions`:
```typescript
mcpServers?: Record<string, any>;
```

- [ ] **Step 2: Widen SDKQueryFn type**

Change `SDKQueryFn` to accept the union prompt type:
```typescript
export type SDKQueryFn = (args: {
  prompt: string | AsyncIterable<{ type: 'user'; message: { role: 'user'; content: string } }>;
  options?: SDKOptions;
}) => Query;
```

- [ ] **Step 3: Pass mcpServers in sendMessage**

In `sendMessage`, when calling `fn({ prompt, options })`, add `mcpServers` from session options:
```typescript
const sdkQuery = fn({
  prompt: content,
  options: {
    ...existingOptions,
    ...(mcpServers ? { mcpServers } : {}),
  },
});
```

Note: If the SDK requires streaming input when mcpServers is present, wrap the prompt:
```typescript
async function* streamPrompt(text: string) {
  yield { type: 'user' as const, message: { role: 'user' as const, content: text } };
}

const sdkQuery = fn({
  prompt: mcpServers ? streamPrompt(content) : content,
  options: { ... },
});
```

- [ ] **Step 4: Thread mcpServers from bridgeServer to session**

In `bridgeServer.ts`, add `mcpServers` to `BridgeServerOptions`. Pass it through to `createBridgeSession`:
```typescript
const session = createBridgeSession({
  cwd,
  onPermissionRequest,
  onAskUserQuestion,
  ...(options.queryFn ? { queryFn: options.queryFn } : {}),
  ...(options.mcpServers ? { mcpServers: options.mcpServers } : {}),
});
```

Update `src/bridge/index.ts` to pass `mcpServers` to `createBridgeServer`:
```typescript
const server = createBridgeServer({
  port, cwd, queryFn: wrappedQuery as any, mcpServers: { archcanvas: mcpServer },
});
```

Wait — actually the `mcpServers` should go through `wrappedQuery` options, not through `BridgeServerOptions`. The MCP server is passed in the `options.mcpServers` of the `query()` call. So we should pass it via `wrappedQuery` (as done in Task 2 Step 2) and NOT thread it separately through `BridgeServerOptions`. Remove this step if Task 2 already handles it via `wrappedQuery`.

Review: if `wrappedQuery` already injects `mcpServers` into the options, then `claudeCodeBridge.ts` doesn't need a separate `mcpServers` field — the injected options flow through automatically. Verify this is the case and skip if redundant.

- [ ] **Step 5: Run tests**

Run: `npx vitest run --project unit test/ai/`
Expected: All pass

- [ ] **Step 6: Commit**

```
feat: wire MCP servers through SDK query options
```

---

### Task 4: Update system prompt

**Files:**
- Modify: `src/core/ai/systemPrompt.ts`
- Modify: `test/ai/types-and-prompt.test.ts`

- [ ] **Step 1: Replace CLI docs with MCP tool docs**

Replace the `## Available CLI Commands` section with MCP tool descriptions. The AI needs to know:
- Tool names (without the `mcp__archcanvas__` prefix — the SDK handles that)
- What each tool does
- Required and optional parameters
- Examples

```typescript
## Available Tools (auto-approved, no permission needed)

### Write Tools
- **add_node** — Add a node: id (string), type (string), name? (string), args? (JSON string), scope? (string)
- **add_edge** — Add an edge: from (string), to (string), fromPort?, toPort?, protocol?, label?, scope?
- **remove_node** — Remove a node: id (string), scope?
- **remove_edge** — Remove an edge: from (string), to (string), scope?
- **import_yaml** — Import from YAML: yaml (string content), scope?

### Read Tools
- **list** — List nodes/edges/entities: scope?, type? (nodes|edges|entities|all)
- **describe** — Describe a node or full architecture: id? (string), scope?
- **search** — Search across canvases: query (string), type? (nodes|edges|entities)
- **catalog** — List available node types: namespace? (string)

### Node Types
- Format: namespace/name (e.g., compute/service, data/database)
- Use catalog tool first to discover available types
- Common namespaces: compute, data, messaging, network, client, integration, security, observability, ai

### Cross-Scope References
- Edges can reference nodes inside subsystems using @<ref-node-id>/<node-id> syntax
- Example: from: "@order-service/processor", to: "db-postgres"

### Guidelines
- Use catalog tool before adding nodes to discover valid types
- Use list/describe tools to understand existing architecture before modifying
- Changes apply to the in-memory canvas only — NOT auto-saved
- Do not tell users changes have been "saved" — confirm they have been "applied"
```

- [ ] **Step 2: Update tests**

Update `test/ai/types-and-prompt.test.ts` — any tests that assert on CLI command text in the system prompt need updating to reference MCP tool names.

- [ ] **Step 3: Run tests**

Run: `npx vitest run --project unit test/ai/types-and-prompt.test.ts`
Expected: All pass

- [ ] **Step 4: Commit**

```
feat: update system prompt for MCP tools (replace CLI commands)
```

---

## Chunk 3: Integration Test + Full Validation

### Task 5: End-to-end validation

- [ ] **Step 1: Build sidecar**

Run: `export PATH="$HOME/.bun/bin:$PATH" && npm run build:sidecar`

- [ ] **Step 2: Test MCP tools via WebSocket**

Start sidecar manually, connect a mock browser WebSocket client that auto-responds to store_actions, and send a chat message that triggers tool use:

```bash
# Start sidecar
./src-tauri/binaries/archcanvas-bridge-aarch64-apple-darwin --port 19999 --cwd /tmp &
# Run test script that connects as browser + sends chat
node test-mcp-tools.js
```

- [ ] **Step 3: Run full unit test suite**

Run: `npx vitest run --project unit`
Expected: All pass (1111+)

- [ ] **Step 4: Build and test Tauri app**

Run:
```bash
rm -rf src-tauri/target/release/bundle
export PATH="$HOME/.bun/bin:$PATH" && npm run tauri -- build --bundles app
open src-tauri/target/release/bundle/macos/ArchCanvas.app
```

Test: Open a project → AI onboarding → verify the AI uses MCP tools (not CLI) to create nodes.

- [ ] **Step 5: Commit**

```
test: validate MCP tools end-to-end in sidecar and Tauri app
```
