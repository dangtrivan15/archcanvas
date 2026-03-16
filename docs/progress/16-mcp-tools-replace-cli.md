# 16: MCP Tools Replace CLI

> **Date**: 2026-03-17 | **Status**: Complete
> **Scope**: Replace 9 CLI commands with in-process MCP tools on the sidecar so the AI can mutate canvases in both web and desktop mode without the `archcanvas` CLI binary

## Recap

The AI integration (I6a) originally worked by having Claude call `archcanvas add-node --id ... --json` via the Bash tool. This required a separate CLI binary, Node.js on PATH, and bridge detection via environment variables. In the Tauri desktop app none of these were available — the CLI isn't bundled, Node.js may not be on PATH, and bridge detection doesn't work. The AI would hang or fail when trying to create nodes.

This milestone replaced that entire path with 9 in-process MCP tools defined via the SDK's `createSdkMcpServer()` + `tool()` helpers. The tools run inside the sidecar binary and relay store actions to the browser via the bridge's existing WebSocket correlation mechanism — the same path the HTTP routes use, minus the HTTP hop and CLI binary. All tools are auto-approved via `allowedTools`, so the user is never prompted for ArchCanvas tool permissions.

The implementation involved three layers of change:
1. **Bridge server** (`src/core/ai/bridgeServer.ts`) — extracted the relay logic from `handleRequest` into a reusable `relayStoreAction()` method, then refactored the HTTP handler to use it
2. **Sidecar entry** (`src/bridge/index.ts`) — defined all 9 MCP tools with Zod schemas and arg translation, created the MCP server, and wired it through `wrappedQuery` with auto-approval
3. **System prompt** (`src/core/ai/systemPrompt.ts`) — replaced CLI command documentation with MCP tool documentation

The CLI still exists for manual/scripting use — this change only decouples the AI path from it.

**What's next**: Release testing and E2E validation of the Tauri desktop build with MCP tools active. The CLI could be removed from the AI path entirely in a follow-up if desired.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Relay mechanism | Reuse bridge WebSocket relay via `relayStoreAction` | Direct store mutation in sidecar | Browser owns store state, undo/redo, and UI updates. Mutations must go through the browser. |
| Arg translation location | In MCP handler before relay | In browser dispatcher | Keep dispatcher unchanged — it already works for CLI and HTTP. Translation is the handler's responsibility. |
| `import_yaml` parsing | Parse YAML in handler, send pre-parsed arrays | Send raw YAML to browser | Matches existing dispatcher contract. Browser expects `nodes`, `edges`, `entities` arrays. |
| `relayStoreAction` scope | Method on server instance | Module-level function | WebSocket state (clients, pendingRequests) is scoped to the server instance. MCP handlers access it via closure. |
| CLI removal | Deferred | Remove in this change | CLI is still useful for manual/scripting. Decoupling reduces risk. |
| `SDKQueryFn` type widening | Widened to accept `string \| AsyncIterable` | Keep string-only | SDK accepts both; widening enables future streaming input without breaking existing callers |
| MCP server placement | Inside `wrappedQuery` options | Separate `BridgeServerOptions` field | MCP servers are a query-level concern. Injecting via `wrappedQuery` keeps `claudeCodeBridge.ts` unchanged. |

## Retrospective

- **What went well** — The `relayStoreAction` extraction was clean. The existing relay logic in `handleRequest` mapped 1:1 to a standalone function, and the HTTP handler became a thin wrapper. The SDK's `tool()` + `createSdkMcpServer()` API worked exactly as documented — Zod v4 schemas were accepted via the `AnyZodRawShape` union type. All 206 AI tests continued to pass after the refactor, confirming the extraction didn't break the HTTP relay path.

- **Lessons** — The SDK accepts both `ZodRawShape` (v3) and `ZodRawShape_2` (v4) via its `AnyZodRawShape` type union. This was non-obvious but important since the project uses Zod 4. Verifying the SDK's type definitions before implementation saved time. The plan's Task 3 (wire MCP through claudeCodeBridge) turned out to be mostly redundant since `wrappedQuery` already handles MCP injection — the type widening was the only meaningful change.

- **Notes for future** — The `parseCanvas` import in `src/bridge/index.ts` is static, which means the YAML library gets bundled into the sidecar binary. This is fine for now (~125KB overhead) but worth noting if bundle size becomes a concern. The HTTP API routes on the bridge server are still functional — they could be removed if only MCP tools are used, but they remain useful for external integrations or debugging.
