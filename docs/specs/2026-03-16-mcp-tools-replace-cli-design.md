# Replace CLI with In-Process MCP Tools

> **Date**: 2026-03-16 | **Phase**: Spec
> **Scope**: Replace 9 CLI commands with in-process MCP tools on the sidecar, auto-approved via SDK allowedTools

## Problem

The AI creates nodes/edges by running `archcanvas add-node` etc. via the Bash tool. This requires:
1. A separate CLI binary (`dist/cli.js`) built via `vite.config.cli.ts`
2. Node.js on PATH to run it
3. The CLI to detect and connect to the bridge HTTP API
4. Bridge detection env vars (`ARCHCANVAS_BRIDGE_URL`)

In the Tauri desktop app, the CLI isn't available — it's not bundled, Node.js may not be on PATH, and bridge detection doesn't work. The AI hangs or fails when trying to create nodes.

The CLI is a thin HTTP proxy to the bridge. The bridge relays to the browser store via WebSocket. The CLI adds no logic beyond argument parsing — all validation happens in the browser-side dispatcher.

## Solution

Define 9 MCP tools via the SDK's `createSdkMcpServer()` + `tool()` helpers. The tools run **in-process** inside the sidecar binary. Each tool handler relays a `store_action` message to the browser via the bridge's existing WebSocket correlation mechanism — the same path the HTTP routes use, minus the HTTP hop and CLI binary.

All MCP tools are listed in `allowedTools` so the SDK auto-approves them without going through `canUseTool`. The user is never prompted for ArchCanvas tool permissions.

## Architecture

### Data Flow

```
Claude calls mcp__archcanvas__add_node({ id, type, name })
  → SDK invokes tool handler (in-process, auto-approved)
  → Handler translates MCP args → dispatcher args (scope→canvasId, flat→nested)
  → Handler sends StoreActionMessage to browser via server.relayStoreAction()
  → Browser dispatcher validates, calls graphStore.addNode()
  → Browser sends StoreActionResult back via WebSocket
  → Handler returns CallToolResult { content: [{ type: "text", text: JSON }] }
  → Claude receives structured result
```

### Streaming Input Requirement

The SDK requires streaming input mode (async generator for `prompt`) when MCP servers are configured. The `sendMessage` flow in `claudeCodeBridge.ts` currently passes `prompt` as a string. This must change to an async generator that yields a single user message.

The `SDKQueryFn` type in `claudeCodeBridge.ts` must be widened: `prompt: string | AsyncIterable<SDKUserMessage>`. The `wrappedQuery` in `src/bridge/index.ts` must also handle the widened type.

## MCP Tool Definitions

### Write Tools

| Tool | Action | Required Args | Optional Args |
|------|--------|---------------|---------------|
| `add_node` | `addNode` | `id: string`, `type: string` | `name?: string`, `args?: string`, `scope?: string` |
| `add_edge` | `addEdge` | `from: string`, `to: string` | `fromPort?: string`, `toPort?: string`, `protocol?: string`, `label?: string`, `scope?: string` |
| `remove_node` | `removeNode` | `id: string` | `scope?: string` |
| `remove_edge` | `removeEdge` | `from: string`, `to: string` | `scope?: string` |
| `import_yaml` | `import` | `yaml: string` | `scope?: string` |

### Read Tools

| Tool | Action | Required Args | Optional Args |
|------|--------|---------------|---------------|
| `list` | `list` | — | `scope?: string`, `type?: string` |
| `describe` | `describe` | — | `id?: string`, `scope?: string` |
| `search` | `search` | `query: string` | `type?: string` |
| `catalog` | `catalog` | — | `namespace?: string` |

### Tool Naming

MCP tool names follow the pattern `mcp__<server>__<tool>`. With server name `archcanvas`:
- `mcp__archcanvas__add_node`
- `mcp__archcanvas__add_edge`
- `mcp__archcanvas__list`
- etc.

### Arg Translation (MCP → Dispatcher)

The browser dispatcher in `webSocketProvider.ts` expects specific arg shapes that differ from the flat MCP tool args. Each MCP handler must translate before relaying:

| Translation | Why |
|-------------|-----|
| `scope` → `canvasId` | Dispatcher reads `args.canvasId`, not `args.scope`. Use `resolveCanvasId(scope)` (ROOT_CANVAS_KEY when omitted). |
| `id` → `nodeId` (remove_node) | Dispatcher reads `args.nodeId` |
| `add_edge` flat fields → nested `edge` object | Dispatcher reads `args.edge` as `{ from: { node, port }, to: { node, port }, protocol, label }` |
| `import_yaml` YAML string → pre-parsed arrays | Dispatcher reads `args.nodes`, `args.edges`, `args.entities`. Handler must YAML-parse and extract before relaying. |

### Handler Pattern

Each handler:
1. Translates MCP args to dispatcher-expected shape (see table above)
2. Calls `server.relayStoreAction(action, translatedArgs)` — a method on the bridge server instance
3. Handles errors: no browser client (return error text), timeout (return error text)
4. Returns `CallToolResult` with the result as JSON text

```typescript
tool('add_node', 'Add a node to the architecture canvas', {
  id: z.string().describe('Unique node identifier'),
  type: z.string().describe('Node type (e.g., compute/service, data/database)'),
  name: z.string().optional().describe('Display name'),
  args: z.string().optional().describe('Constructor arguments (JSON string)'),
  scope: z.string().optional().describe('Canvas scope (omit for root)'),
}, async (toolArgs) => {
  const canvasId = toolArgs.scope ?? ROOT_CANVAS_KEY;
  const result = await server.relayStoreAction('addNode', {
    canvasId,
    id: toolArgs.id,
    type: toolArgs.type,
    name: toolArgs.name,
    args: toolArgs.args,
  });
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
})
```

### Error Handling

`server.relayStoreAction()` returns a `StoreActionResult` (same type used by HTTP relay). The handler checks `result.ok`:
- `ok: true` → return `{ content: [{ type: 'text', text: JSON.stringify(result.data) }] }`
- `ok: false` → return `{ content: [{ type: 'text', text: JSON.stringify(result.error) }], isError: true }`
- No browser client → return `{ content: [{ type: 'text', text: 'No browser connected' }], isError: true }`
- Timeout → return `{ content: [{ type: 'text', text: 'Browser did not respond in time' }], isError: true }`

## Files Changed

| File | Change |
|------|--------|
| `src/bridge/index.ts` | Define MCP server with 9 tools using `tool()` + `createSdkMcpServer()`. Each handler calls `server.relayStoreAction()`. Pass server in `mcpServers` option of `wrappedQuery`. Update `wrappedQuery` to handle widened prompt type. Import YAML parser for `import_yaml` handler. |
| `src/core/ai/bridgeServer.ts` | Add `relayStoreAction(action, args): Promise<StoreActionResult>` method to the object returned by `createBridgeServer()`. Extracts the existing HTTP relay logic (find client, create correlation, send, await with timeout) into a reusable method. |
| `src/core/ai/claudeCodeBridge.ts` | Accept `mcpServers` in `BridgeSessionOptions`. Pass to SDK `query()` options. Add all 9 MCP tool names to `allowedTools`. Widen `SDKQueryFn` type: `prompt: string | AsyncIterable<SDKUserMessage>`. Wrap `prompt` string in async generator when MCP servers are present. |
| `src/core/ai/systemPrompt.ts` | Replace CLI command documentation with MCP tool documentation. Remove `archcanvas` CLI references. Describe tool names, args, and examples in the format Claude will see them. |
| `test/` | Update bridge tests, system prompt tests, and add MCP tool handler tests (arg translation, error cases). |

## Design Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Tool hosting | In-process MCP server in sidecar | External MCP server process | Same process, no networking, reuses existing WebSocket relay |
| Auto-approve | `allowedTools` list | `canUseTool` callback | User should never be prompted for canvas mutations — they initiated the AI session |
| Relay mechanism | Reuse bridge WebSocket relay | Direct store mutation in sidecar | Browser owns the store state, undo/redo, and UI updates. Mutations must go through the browser. |
| Arg translation | In MCP handler before relay | In browser dispatcher | Keep dispatcher unchanged — it already works for CLI and HTTP paths. Translation is the handler's responsibility. |
| import_yaml | Parse YAML in handler, send pre-parsed arrays | Send raw YAML to browser | Matches existing dispatcher contract. Browser dispatcher expects `nodes`, `edges`, `entities` arrays. |
| relayStoreAction | Method on server instance | Module-level function | WebSocket state (clients, pendingRequests) is scoped to the server instance. MCP handlers receive the server reference via closure. |
| CLI removal | Defer to follow-up | Remove in this change | CLI is still useful for manual/scripting use. Decoupling the changes reduces risk. |
| Streaming input | Wrap prompt in async generator | Refactor sendMessage signature | Minimal change — generator yields one user message, satisfies SDK requirement |

## Future Work

- Remove CLI dependency from the AI path entirely (CLI can remain for manual use)
- Consider removing `src/cli/` if no longer needed
- Remove HTTP API routes from bridge if only MCP tools are used (routes still useful for external integrations)
