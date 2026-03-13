# I6a: AI Integration — Design Spec

> **Date**: 2026-03-13 | **Status**: Review
> **Scope**: ClaudeCodeProvider via bridge, chat panel UI, HTTP mutation API, backend selector
> **Depends on**: I5 (CLI & Persistence UI) — complete

---

## 1. Overview

I6a delivers AI-powered architecture editing through a chat interface. The user converses with Claude Code in a chat panel; Claude Code autonomously calls `archcanvas` CLI commands to modify the architecture; mutations flow through the browser's Zustand stores for reactive UI updates.

This is the first of two sub-initiatives split from I6:
- **I6a** (this spec): AI integration — ChatProvider interface, ClaudeCodeProvider, bridge server, chat panel, HTTP mutation API
- **I6b** (future): Onboarding wizard — guided project initialization using the AI integration built in I6a

### Key Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Backend priority | ClaudeCodeProvider first | ApiKeyProvider first | More accessible for testing, less orchestration code in-app |
| Bridge architecture | Always through WebSocket (Option B) | Direct subprocess on desktop | Zero duplication — one provider, one bridge, all platforms |
| Bridge hosting (dev) | Vite plugin on same port | Separate process/port | Zero-config DX, no extra process, works for both web and Tauri dev |
| Chat panel placement | Toggleable right panel (Option C) | Bottom drawer / tab | Full-height chat, clean toggle, no new layout regions |
| Canvas live updates | HTTP mutation API through stores | Reload on tool_result | Reactive updates, no flicker, stores are single source of truth |
| Permission handling | Surface all to chat panel | Auto-accept / allowlist | Let Claude Code's own permission system work as designed |
| Claude Code integration | `@anthropic-ai/claude-code` SDK | Raw CLI subprocess | Clean API, typed events, session management built-in |

---

## 2. Architecture

### System Diagram

```
Browser                          Vite Dev Server (Node.js)
┌─────────────────────┐          ┌──────────────────────────┐
│  ChatPanel (React)   │          │  vite-plugin-ai-bridge   │
│    ↕                 │          │    ↕                     │
│  chatStore (Zustand) │◄──WS───►│  claudeCodeBridge        │
│    ↕                 │          │    ↕                     │
│  WebSocket           │          │  @anthropic-ai/claude-code│
│  ClaudeCodeProvider  │          │    ↕                     │
│    ↕                 │          │  Claude Code process     │
│  graphStore          │◄──HTTP──►│  HTTP mutation endpoints  │
│  (reactive UI)       │          │                          │
└─────────────────────┘          └──────────────────────────┘
                                          ↕
                                  archcanvas CLI
                                  (called by Claude Code)
                                          ↕
                                  .archcanvas/ (YAML files)
```

### Data Flow: User Sends a Chat Message

1. User types message in ChatPanel → `chatStore.sendMessage(content)`
2. chatStore calls `provider.sendMessage(content, context)` on active provider
3. WebSocketClaudeCodeProvider sends `{ type: 'chat', content, context }` over WebSocket
4. Bridge receives message, passes to Claude Code SDK with system prompt + project context
5. Claude Code processes the request, decides to run `archcanvas add-node --json`
6. CLI detects running bridge (`GET /__archcanvas_ai/health`)
7. CLI sends `POST /__archcanvas_ai/api/add-node { args }` to bridge
8. Bridge relays mutation via WebSocket to browser
9. Browser handler calls `graphStore.addNode(args)` → UI re-renders reactively
10. `fileStore` persists changes to disk
11. Result flows back: browser → WebSocket → bridge → HTTP response → CLI stdout
12. Claude Code sees the CLI result, emits text/tool_result events
13. Bridge relays ChatEvents back over WebSocket to browser
14. chatStore updates messages, ChatPanel renders incrementally

### Data Flow: Permission Request

1. Claude Code wants to run a command → SDK emits permission request
2. Bridge sends `{ type: 'permission_request', id, tool, command }` over WebSocket
3. ChatPanel renders a permission card with approve/deny buttons
4. User clicks approve → chatStore sends `{ type: 'permission_response', id, allowed: true }` via WebSocket
5. Bridge receives response, resumes Claude Code session
6. If denied, Claude Code receives denial and adjusts its approach

### Data Flow: CLI Without Bridge (Fallback)

1. `archcanvas add-node --json` runs (no UI open)
2. CLI tries `GET /__archcanvas_ai/health` → fails
3. CLI falls back to current behavior: load stores in-process, mutate, save to disk, output JSON
4. No UI update needed — no UI is open

---

## 3. ChatProvider Interface

```typescript
// src/core/ai/types.ts

type ChatEvent =
  | { type: 'text'; requestId: string; content: string }
  | { type: 'tool_call'; requestId: string; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; requestId: string; id: string; result: string; isError?: boolean }
  | { type: 'thinking'; requestId: string; content: string }
  | { type: 'permission_request'; requestId: string; id: string; tool: string; command: string }
  | { type: 'done'; requestId: string }
  | { type: 'error'; requestId: string; message: string }

// Browser → Bridge (for interactive responses)
type ClientMessage =
  | { type: 'chat'; requestId: string; content: string; context: ProjectContext }
  | { type: 'abort' }
  | { type: 'load_history'; messages: ChatMessage[] }
  | { type: 'permission_response'; id: string; allowed: boolean }

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  events?: ChatEvent[]           // raw events for assistant messages
  timestamp: number
}

interface ProjectContext {
  projectName: string
  projectDescription?: string
  currentScope: string
  projectPath: string
}

interface ChatProvider {
  readonly id: string             // e.g. 'claude-code'
  readonly displayName: string    // e.g. 'Claude Code'
  readonly available: boolean     // runtime check (is bridge reachable?)

  sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent>
  loadHistory(messages: ChatMessage[]): void
  abort(): void
}
```

### Design Notes

- **Provider is stateless from the store's perspective** — the store owns message history for UI display. The provider manages its own backend session state internally.
- **`loadHistory`** is a lifecycle method called when restoring a previous conversation. Each provider handles it differently:
  - ClaudeCodeProvider: may start a new session with a condensed summary, or resume via stored session ID
  - ApiKeyProvider (future): stores messages internally for subsequent API calls
- **`available`** is a reactive check — the WebSocketClaudeCodeProvider returns `true` when the WebSocket connection is open, `false` when disconnected. The backend selector uses this to indicate availability.
- **`sendMessage` returns `AsyncIterable<ChatEvent>`** — the store iterates over events and builds the assistant message incrementally.

---

## 4. chatStore

```typescript
// src/store/chatStore.ts

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  activeProviderId: string | null
  providers: Map<string, ChatProvider>
  error: string | null

  // Actions
  registerProvider(provider: ChatProvider): void
  setActiveProvider(id: string): void
  sendMessage(content: string): Promise<void>
  respondToPermission(id: string, allowed: boolean): void
  abort(): void
  clearHistory(): void
}
```

### Behavior

- **`sendMessage`**: Gets active provider → assembles `ProjectContext` from other stores (`fileStore`, `navigationStore`, `registryStore`) → calls `provider.sendMessage()` → iterates `ChatEvent`s → appends to current assistant message → sets `isStreaming = true` → on `done`/`error` sets `isStreaming = false`.
- **`registerProvider`**: Called at app startup. For I6a, registers `WebSocketClaudeCodeProvider` only. Backend selector shows all registered providers.
- **`respondToPermission`**: Sends permission response to the provider (which relays via WebSocket to bridge).
- **`abort`**: Calls `provider.abort()`, sets `isStreaming = false`.
- **Cross-store reads**: Uses `getState()` on `fileStore` (project name/path), `navigationStore` (current scope), `registryStore` (available node types). No circular dependencies.

---

## 5. Bridge Server & Vite Plugin

### Claude Code Bridge

```typescript
// src/core/ai/claudeCodeBridge.ts
// Pure Node.js — wraps @anthropic-ai/claude-code SDK

interface BridgeSession {
  sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent>
  respondToPermission(id: string, allowed: boolean): void
  loadHistory(messages: ChatMessage[]): void
  abort(): void
}

function createBridgeSession(options: { cwd: string }): BridgeSession
```

Responsibilities:
- Creates and manages Claude Code SDK sessions
- Translates SDK events to `ChatEvent` types
- Handles permission request/response relay
- Constructs system prompt from `ProjectContext`
- Sets `cwd` to project root for CLI command resolution

### Vite Plugin

```typescript
// src/core/ai/vitePlugin.ts

import type { Plugin } from 'vite'

export function aiBridgePlugin(): Plugin {
  return {
    name: 'archcanvas-ai-bridge',
    configureServer(server) {
      // 1. WebSocket endpoint: ws://localhost:5173/__archcanvas_ai
      //    - Handles chat messages, abort, load_history, permission_response
      //    - Streams ChatEvents back to browser
      //
      // 2. HTTP endpoints on server.middlewares:
      //    GET  /__archcanvas_ai/health
      //    POST /__archcanvas_ai/api/add-node
      //    POST /__archcanvas_ai/api/add-edge
      //    POST /__archcanvas_ai/api/remove-node
      //    POST /__archcanvas_ai/api/remove-edge
      //    POST /__archcanvas_ai/api/import
      //
      // 3. HTTP mutation handler:
      //    - Receives mutation args from CLI
      //    - Sends { type: 'store_action', action, args } via WebSocket to browser
      //    - Waits for result from browser
      //    - Returns result as HTTP response (JSON, same format as CLI output)
    }
  }
}
```

### System Prompt

Injected into the Claude Code session:

```
You are an architecture assistant for ArchCanvas. You modify the user's
architecture using the `archcanvas` CLI. The project is located at {projectPath}.

Available commands:
- archcanvas list [--scope <id>] [--type nodes|edges|entities] --json
- archcanvas describe [<nodeId>] [--scope <id>] --json
- archcanvas search <query> --json
- archcanvas add-node --id <id> --type <type> [--scope <id>] [--displayName <name>] --json
- archcanvas add-edge --from <nodeId> --to <nodeId> [--fromPort <port>] [--toPort <port>] [--protocol <p>] [--label <l>] --json
- archcanvas remove-node <id> [--scope <id>] --json
- archcanvas remove-edge --from <nodeId> --to <nodeId> [--scope <id>] --json
- archcanvas import <file> [--scope <id>] --json

The user is currently viewing scope: {currentScope}
Project name: {projectName}
Always use --json flag for structured output.
```

Claude Code discovers and calls CLI commands on its own via its Bash tool. No custom tool definitions needed — the system prompt is the only integration point.

---

## 6. HTTP Mutation API

### Purpose

When the UI is running, CLI mutation commands route through the browser's Zustand stores instead of writing files directly. This provides reactive UI updates without reload.

### CLI Bridge Detection

```typescript
// Added to CLI context loading (src/cli/context.ts)

async function detectBridge(): Promise<string | null> {
  try {
    const resp = await fetch('http://localhost:5173/__archcanvas_ai/health')
    if (resp.ok) return 'http://localhost:5173/__archcanvas_ai'
  } catch { /* bridge not running */ }
  return null
}
```

The CLI checks for a running bridge at startup. If found, mutation commands send HTTP requests instead of local file writes. Read-only commands (`list`, `describe`, `search`) always run locally — no round-trip needed.

### Mutation Flow

CLI → HTTP POST → Bridge → WebSocket → Browser → `graphStore.addNode()` → UI re-renders → `fileStore` persists → result flows back

### Timeout & Error Handling

The HTTP mutation handler blocks while waiting for the browser's WebSocket acknowledgment. To prevent indefinite hangs:
- **Timeout**: 10 seconds for browser acknowledgment. If exceeded, return HTTP 504 with `{ ok: false, error: { code: 'BRIDGE_TIMEOUT', message: 'Browser did not respond in time' } }`.
- **WebSocket disconnect mid-request**: Return HTTP 502 with `{ ok: false, error: { code: 'BRIDGE_DISCONNECTED', message: 'Browser connection lost' } }`.
- **Browser returns engine error** (`ok: false`): Forward the engine error as-is in the HTTP response.
- CLI receives these errors and outputs them as normal `--json` error output.

### Persistence After Mutation

After applying a mutation via `graphStore`, the browser mutation handler calls `fileStore.save()` (not `saveAll(fs)`) — this uses the internally stored `fs` ref that was set when the project was opened. If `fileStore.fs` is null when the mutation handler runs (project opened by CLI without a browser file picker), the handler should detect this and return an error to the CLI rather than falling through to `saveAs()`, which would attempt to open a file dialog.

### Port Discovery

For I6a, the bridge URL is hardcoded to `http://localhost:5173/__archcanvas_ai` (Vite's default dev port). `detectBridge()` relies on Vite's `strictPort: true` (already set in `vite.config.ts`). If this is ever removed, the hardcoded URL may silently miss the running bridge. This constraint should be documented in a comment in both `detectBridge()` and `vite.config.ts`. Future improvement: write the bridge URL to a well-known file (e.g., `.archcanvas/.bridge`) for dynamic discovery.

---

## 7. WebSocketClaudeCodeProvider

```typescript
// src/core/ai/webSocketProvider.ts

class WebSocketClaudeCodeProvider implements ChatProvider {
  readonly id = 'claude-code'
  readonly displayName = 'Claude Code'
  private ws: WebSocket | null = null

  get available(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  connect(url: string): void {
    // Establish WebSocket connection to bridge
    // Auto-reconnect on disconnect
  }

  sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent> {
    // Send { type: 'chat', content, context } over WebSocket
    // Return async generator that yields ChatEvents as they arrive
  }

  loadHistory(messages: ChatMessage[]): void {
    // Send { type: 'load_history', messages } over WebSocket
    // Bridge re-establishes Claude Code session context
  }

  abort(): void {
    // Send { type: 'abort' } over WebSocket
  }
}
```

Lives in `src/core/ai/` — pure TypeScript, uses standard browser `WebSocket` API. No React dependency.

### Request Correlation

Each `sendMessage` call generates a unique `requestId` (ULID). The `ClientMessage` includes this ID, and incoming `ChatEvent`s carry it so the `AsyncIterable` filters events belonging to the current request. The `chatStore.isStreaming` guard prevents concurrent `sendMessage` calls from the UI, but the correlation ID provides defense-in-depth for the WebSocket stream. The iterable completes when it receives `{ type: 'done' }` or `{ type: 'error' }` matching its `requestId`.

---

## 8. Chat Panel UI

### Components

```
src/components/panels/
  ChatPanel.tsx                ← main panel: message list + input + provider selector
  ChatMessage.tsx              ← single message bubble (user or assistant)
  ChatToolCall.tsx             ← collapsible tool call/result display
  ChatPermissionCard.tsx       ← approve/deny card for permission requests
  ChatProviderSelector.tsx     ← dropdown in panel header (Claude Code for now)
```

### Toggle Mechanism

- New chat button in the left toolbar (bottom position)
- `uiStore` gains `rightPanelMode: 'details' | 'chat'`
- `RightPanel.tsx` switches content based on mode
- `rightPanelMode` is stored as Zustand state (not a module-level ref) so that `RightPanel` can subscribe and re-render when the panel switches between detail and chat modes. This is a deliberate departure from the existing `uiStore` pattern (which uses module-level refs for panel handles) — reactive mode switching requires Zustand subscription.
- `archcanvas:toggle-chat` custom event: sets `uiStore.rightPanelMode = 'chat'` and calls `uiStore.openRightPanel()` if collapsed (mirrors existing `openRightPanel` pattern)
- Keyboard shortcut: `Cmd+Shift+I` (for "AI" — `Cmd+Shift+L` is taken by Auto Layout)

### Chat Panel Layout

```
┌──────────────────────────────┐
│ AI Chat    [Claude Code ▾] ✕ │  ← header: title, provider selector, close
├──────────────────────────────┤
│                              │
│ ┌──────────────────────┐     │
│ │ User message         │     │  ← right-aligned bubble
│ └──────────────────────┘     │
│                              │
│ ┌──────────────────────┐     │
│ │ Assistant message     │     │  ← left-aligned bubble
│ │                       │     │
│ │ ▶ archcanvas add-node │     │  ← collapsible tool call
│ │                       │     │
│ │ More text response... │     │
│ └──────────────────────┘     │
│                              │
│ ┌──────────────────────┐     │
│ │ ⚠ Allow Bash:        │     │  ← permission card
│ │ archcanvas remove...  │     │
│ │ [Approve] [Deny]     │     │
│ └──────────────────────┘     │
│                              │
├──────────────────────────────┤
│ Ask AI about your arch...    │  ← input box
│                    [Send ↵]  │
└──────────────────────────────┘
```

### Streaming Display

- Text arrives as `{ type: 'text' }` events — append to current message incrementally
- Show a cursor/pulse indicator while `isStreaming` is true
- Tool calls render as collapsible blocks: header shows tool name + command, expanded shows args + result
- Thinking events render as a dimmed collapsible section (if present)

---

## 9. File Structure

### New Files

```
src/core/ai/
  types.ts                     ← ChatProvider, ChatEvent, ChatMessage, ProjectContext, ClientMessage
  claudeCodeBridge.ts          ← Claude Code SDK wrapper (Node.js only, never imported by browser code)
  webSocketProvider.ts         ← WebSocketClaudeCodeProvider (browser)
  vitePlugin.ts                ← Vite plugin hosting bridge + HTTP endpoints (Node.js only)
  systemPrompt.ts              ← System prompt construction from ProjectContext

Note: `claudeCodeBridge.ts` and `vitePlugin.ts` are Node.js-only. They are imported only by
`vite.config.ts` (which runs in Node.js), never by browser application code. To prevent accidental
browser bundling, add both to Vite's `build.rollupOptions.external` in `vite.config.ts`, following
the same pattern used for Tauri modules.

src/store/
  chatStore.ts                 ← new Zustand store

src/components/panels/
  ChatPanel.tsx                ← main chat panel
  ChatMessage.tsx              ← message bubble component
  ChatToolCall.tsx             ← collapsible tool call display
  ChatPermissionCard.tsx       ← permission approve/deny card
  ChatProviderSelector.tsx     ← backend selector dropdown
```

### Modified Files

```
src/store/uiStore.ts           ← add rightPanelMode: 'details' | 'chat'
src/components/layout/RightPanel.tsx  ← switch on rightPanelMode
src/components/layout/LeftToolbar.tsx ← add chat toggle button
src/components/hooks/useAppKeyboard.ts ← add Cmd+Shift+I shortcut
src/cli/context.ts             ← add bridge detection
src/cli/commands/add-node.ts   ← HTTP client path when bridge detected
src/cli/commands/add-edge.ts   ← HTTP client path when bridge detected
src/cli/commands/remove-node.ts ← HTTP client path when bridge detected
src/cli/commands/remove-edge.ts ← HTTP client path when bridge detected
src/cli/commands/import.ts     ← HTTP client path when bridge detected
vite.config.ts                 ← register aiBridgePlugin()
package.json                   ← add @anthropic-ai/claude-code dependency
```

---

## 10. Testing Strategy

### Mock Claude Code SDK

A fake SDK implementation that emits realistic event sequences for testing:

```typescript
// test/mocks/mockClaudeCode.ts

// Predefined scenarios:
// 1. Text streaming: text → text → text → done
// 2. Tool call flow: text → permission_request → (approved) → tool_call → tool_result → text → done
// 3. Permission denied: text → permission_request → (denied) → text (adjusted approach) → done
// 4. Clarifying question: text (question) → done (waits for user reply)
// 5. Error: text → error
// 6. Abort mid-stream: text → text → (abort) → done
// 7. Multiple mutations: tool_call → tool_result → tool_call → tool_result → done
```

### Unit Tests

- **ChatProvider interface** — contract tests with mock provider
- **chatStore** — message management, provider registration, streaming state, abort, permission responses
- **WebSocketClaudeCodeProvider** — WebSocket message serialization, event parsing, reconnection, `loadHistory`
- **System prompt construction** — correct context injection from ProjectContext
- **claudeCodeBridge** — SDK event → ChatEvent translation (using mock SDK)

### Integration Tests

- **Bridge server** — WebSocket lifecycle, HTTP mutation endpoints, permission relay
- **Full message flow** — mock SDK → bridge → WebSocket → provider → chatStore → verify events
- **Permission flow** — permission_request surfaces, approve/deny relays correctly, session resumes/stops
- **Clarifying question flow** — AI asks question, user responds, conversation continues
- **CLI bridge detection** — HTTP client sends mutations, fallback to direct file writes when bridge unavailable
- **HTTP mutation round-trip** — CLI → HTTP → bridge → WebSocket → browser store → result back to CLI
- **Bridge timeout** — browser WebSocket disconnects after HTTP request received, bridge returns 502
- **Engine error relay** — browser store returns `ok: false`, bridge forwards error to CLI
- **Concurrent HTTP mutations** — two simultaneous mutation requests are serialized correctly through the browser stores

### E2E Tests (Playwright)

- Chat panel toggle via toolbar button
- Send message and see response render
- Permission card renders, approve/deny works
- Provider selector shows Claude Code option
- Chat panel shows error state when bridge disconnects
- Streaming text appears incrementally

### What We Don't Test

- Actual Claude Code responses (too slow, flaky, requires API credentials)
- SDK internals — mock at the SDK boundary

---

## 11. Error Handling

### Connection Failures

- **WebSocket disconnects mid-conversation**: `chatStore` sets `error`, chat panel shows reconnection indicator, provider `available` becomes `false`
- **CLI can't reach bridge**: falls back to direct file mutation (existing behavior, no UI impact)
- **Claude Code SDK errors** (not installed, quota): bridge emits `{ type: 'error', message }`, chat panel shows inline error

### Mutation Conflicts

- **User + AI editing simultaneously**: no conflict — both go through the same `graphStore` (HTTP API route serializes mutations through browser stores)
- **Bridge down, CLI falls back to file writes while UI open**: stale UI. Acceptable edge case — user can manually reload.

### Abort Semantics

- User clicks abort → `chatStore.abort()` → WebSocket → bridge → SDK abort → Claude Code stops → `{ type: 'done' }`
- Partial mutations persist — if AI added 3 of 5 nodes before abort, those 3 stay. Correct behavior.

### Session Lifecycle

- App opens → WebSocket connects → provider `available = true`
- App closes → WebSocket disconnects → bridge cleans up Claude Code session
- Vite HMR reload → WebSocket reconnects, Claude Code session lost. `chatStore` keeps messages for display. `loadHistory` can re-establish context on next message.

---

## 12. Dependencies

### New

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/claude-code` | Claude Code SDK for programmatic AI sessions |
| `ws` | WebSocket server for Vite plugin (Node.js side) |

### Existing (No Changes)

- `zustand` — chatStore
- `react` — ChatPanel components
- `commander` — CLI (modified for bridge detection)
- `vite` — plugin API

---

## 13. Scope Boundaries

### In Scope (I6a)

- ChatProvider interface
- ClaudeCodeProvider via bridge (WebSocket + SDK)
- Vite plugin hosting bridge and HTTP mutation endpoints
- chatStore (Zustand)
- Chat panel UI with toggle, streaming, tool calls, permission cards
- Backend selector (with Claude Code as only option)
- HTTP mutation API for reactive canvas updates
- CLI bridge detection + HTTP client for mutations
- System prompt with project context
- Mock Claude Code SDK for testing
- Unit, integration, and E2E tests

### Out of Scope (Deferred)

| Feature | Deferred To |
|---------|-------------|
| ApiKeyProvider (Anthropic API direct) | I6a follow-up |
| Onboarding wizard | I6b |
| Conversation persistence to disk | I6a follow-up |
| `archcanvas serve` standalone command | I7 |
| Tauri sidecar packaging | I7 |
| HTTP mutation API → store forwarding (replacing reload) | Architectural direction, built in I6a as HTTP endpoints with WebSocket relay |
| Dynamic bridge port discovery | I7 |
| Protocol compatibility matrix | I7 |

---

## 14. Future Architecture Direction

The HTTP mutation API built in I6a establishes a pattern for future evolution:

1. **Production bridge** (I7): Extract bridge into `archcanvas serve` command for standalone use outside Vite dev server
2. **Tauri sidecar** (I7): Bundle `archcanvas serve` as a Tauri sidecar, auto-launched by the desktop app
3. **Dynamic port discovery**: Write bridge URL to `.archcanvas/.bridge` file for CLI auto-detection across ports
4. **ApiKeyProvider**: Implements same ChatProvider interface, manages its own tool loop, uses same chat panel. Backend selector gains a second option.
5. **Multi-model support**: Additional providers (OpenAI, Ollama) implement ChatProvider and register with chatStore
