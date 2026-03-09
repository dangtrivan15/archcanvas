# P03: AI Integration Layer

**Parallel safety**: DEPENDS ON P02 (new aiStore) and P01 (DialogHost for AI setup dialogs).
Can start interface/strategy design immediately, but full integration needs P02 done.

---

## Problem

### Bridge is Dev-Only

`src/bridge/viteBridgePlugin.ts` only works during `npm run dev`:
```typescript
// viteBridgePlugin.ts — line 49
apply: 'serve'  // Only Vite dev server, not production builds
```

The bridge spawns a new Claude Code CLI process per WebSocket connection with no session
reuse or pooling.

### No AI Chat UI

There is no AI chat panel in the app. The old AI state was removed:
```typescript
// coreStore.ts lines 476-480
// AI state from file is ignored — AI store has been removed.
// Proto compatibility is maintained: aiState is still decoded/encoded by fileIO
```

### bridgeConnection.ts is 385 Lines of Unused Code

`src/services/bridgeConnection.ts` implements a WebSocket client but nothing in the UI calls it.

### iPad Has No AI Path

The bridge requires a local Claude Code CLI, which won't exist on iPad. There's no API
token fallback.

---

## Proposed Solution

### A. AI Connection Strategy Pattern

```
src/ai/
  types.ts                    -- Interfaces, message types
  connectionManager.ts        -- Strategy selection + switching
  strategies/
    claudeCodeStrategy.ts     -- Local Claude Code CLI via WebSocket bridge
    apiTokenStrategy.ts       -- Direct Anthropic API calls
  context/
    architectureContext.ts     -- Build context from current graph state
```

**Connection interface:**
```typescript
// src/ai/types.ts
export interface AIConnection {
  readonly type: 'claude-code' | 'api-token';
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error';

  connect(): Promise<void>;
  disconnect(): void;

  sendMessage(message: string, context: AIContext): AsyncIterable<AIStreamChunk>;
  cancelCurrentRequest(): void;

  onStatusChange(handler: (status: ConnectionStatus) => void): () => void;
}

export interface AIContext {
  architectureSummary: string;       // describe() output
  currentNavigationPath: string[];   // fractal zoom location
  selectedNodeIds: string[];         // what user has selected
  selectedNodeDetails?: NodeDetail[];// expanded info on selected nodes
  projectPath?: string;              // repo root for Claude Code
}

export interface AIStreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}
```

**Connection manager:**
```typescript
// src/ai/connectionManager.ts
export class ConnectionManager {
  private strategy: AIConnection | null = null;

  async connect(preferred: 'claude-code' | 'api-token'): Promise<AIConnection> {
    if (preferred === 'claude-code') {
      try {
        const cc = new ClaudeCodeStrategy(bridgeUrl);
        await cc.connect();
        return cc;
      } catch {
        // Fall back to API token
        console.warn('Claude Code unavailable, falling back to API token');
      }
    }

    const api = new ApiTokenStrategy(apiKey);
    await api.connect();
    return api;
  }
}
```

### B. Claude Code Strategy

Refactor the existing bridge connection to implement the strategy interface:

```typescript
// src/ai/strategies/claudeCodeStrategy.ts
export class ClaudeCodeStrategy implements AIConnection {
  readonly type = 'claude-code';
  private ws: WebSocket | null = null;

  constructor(private bridgeUrl: string) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.bridgeUrl);
    // Handshake, verify Claude Code is available
  }

  async *sendMessage(message: string, context: AIContext): AsyncIterable<AIStreamChunk> {
    // Send message + context over WebSocket
    // Yield streaming chunks as they arrive
    // Claude Code has full MCP tool access to the .archc file
  }
}
```

### C. API Token Strategy

For iPad and when Claude Code CLI isn't available:

```typescript
// src/ai/strategies/apiTokenStrategy.ts
export class ApiTokenStrategy implements AIConnection {
  readonly type = 'api-token';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *sendMessage(message: string, context: AIContext): AsyncIterable<AIStreamChunk> {
    // Call Anthropic API directly with tool definitions
    // Tools are a subset of MCP tools (add_node, add_edge, describe, etc.)
    // Applied directly to the in-memory graph
  }
}
```

### D. AI Chat Panel

```
src/components/panels/
  AIChatPanel.tsx           -- Main chat window
  AIChatMessage.tsx         -- Message bubble (user or AI)
  AIChatToolCall.tsx        -- Shows tool calls transparently
  AIChatInput.tsx           -- Input area with send/cancel
  AIConnectionIndicator.tsx -- Shows "Claude Code" or "API" mode
```

**Chat panel behavior:**
- When connected to Claude Code: acts as a "shell emulator" showing streaming output,
  tool calls, and confirmation prompts just like a terminal
- When using API token: standard chat with tool-use visualization
- Always shows which tools the AI is calling and their results
- Architecture context is automatically included with each message

### E. Architecture Context Builder

Automatically provides the AI with relevant context about what the user is looking at:

```typescript
// src/ai/context/architectureContext.ts
export function buildAIContext(
  graph: ArchGraph,
  navigationPath: string[],
  selectedNodeIds: string[],
  textApi: TextApi
): AIContext {
  return {
    architectureSummary: textApi.describe(graph, { format: 'ai' }),
    currentNavigationPath: navigationPath,
    selectedNodeIds,
    selectedNodeDetails: selectedNodeIds.map(id => textApi.getNode(graph, id)),
  };
}
```

### F. Bridge for Production

Decouple the bridge from Vite dev server:

**Option 1 — Standalone bridge process (web app):**
```
archcanvas bridge start --port 9876
# User runs this on their local machine
# Web app connects to localhost:9876
```

**Option 2 — Embedded in desktop shell (Tauri/Electron):**
The desktop app's native process manages the bridge and Claude Code subprocess.

**Option 3 — iPad:**
No bridge. API token only. The app includes MCP tool definitions and applies them
directly to the in-memory graph.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/bridge/server.ts` | Refactor into Claude Code strategy |
| `src/bridge/viteBridgePlugin.ts` | Keep for dev, add standalone mode |
| `src/services/bridgeConnection.ts` | Refactor into strategy base class or delete |
| `src/core/storage/fileIO.ts` | Clean up dead AI state handling (coordinate with P09) |

**New files:**
- `src/ai/types.ts`
- `src/ai/connectionManager.ts`
- `src/ai/strategies/claudeCodeStrategy.ts`
- `src/ai/strategies/apiTokenStrategy.ts`
- `src/ai/context/architectureContext.ts`
- `src/store/aiStore.ts`
- `src/components/panels/AIChatPanel.tsx`
- `src/components/panels/AIChatMessage.tsx`
- `src/components/panels/AIChatToolCall.tsx`
- `src/components/panels/AIChatInput.tsx`
- `src/components/panels/AIConnectionIndicator.tsx`

---

## Acceptance Criteria

1. AI chat panel renders in the right panel (tab alongside node details)
2. Can connect to Claude Code CLI when available (dev mode bridge works)
3. Falls back to API token when bridge unavailable
4. UI shows which connection mode is active
5. Streaming AI responses render progressively
6. Tool calls are shown transparently (what tool, what input, what result)
7. Architecture context is sent with each message automatically
8. `npm run build` succeeds
9. Chat history persists in the `.archc` file's AIState proto field
