# API Key Provider — Design Spec

> **Date**: 2026-03-21 | **Status**: Approved
> **Scope**: In-browser ChatProvider using the Anthropic Messages API with user-supplied API key, shared tool definitions, model selection, settings dialog

---

## Prerequisites

This spec depends on the Entity Creation UI spec (`2026-03-20-entity-creation-ui-design.md`) being implemented first. That spec adds 3 entity tools (`add_entity`, `remove_entity`, `update_entity`) to `mcpTools.ts` and `storeActionDispatcher.ts`. This spec references all 12 tools (9 existing + 3 entity).

If entity tools are not yet implemented, this spec works with the 9 existing tools — the shared tool definitions and provider are designed to be additive.

---

## Problem

ArchCanvas currently supports AI chat only through the Claude Code SDK via a WebSocket bridge server (Node.js). This requires either a Vite dev/preview server or a Tauri sidecar — it doesn't work in a standalone web deployment. Users who have their own Anthropic API key should be able to use AI features directly from the browser without any server-side component.

The design doc (section 7) specifies two AI backends behind one `ChatProvider` interface: `ClaudeCodeProvider` (implemented) and `ApiKeyProvider` (this spec). The `storeActionDispatcher` is already provider-agnostic and callable directly in-browser.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| SDK | `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true` | Raw fetch / Claude Agent SDK | Official SDK handles streaming, retries, CORS headers, TypeScript types. Browser-compatible with CORS support via `anthropic-dangerous-direct-browser-access` header. |
| Interface | `ChatProvider` only | `InteractiveChatProvider` | All ArchCanvas tools are auto-approved canvas mutations — no permission prompts needed. Interactive features (permissions, questions, mode/effort) are Claude Code SDK concepts. |
| Tool loop | Manual loop | SDK `toolRunner` | Full control over streaming, tool execution order, interruption, and ChatEvent emission. `toolRunner` is beta API with less control. |
| Tool definitions | Shared from `mcpTools.ts` | Duplicate definitions | Single source of truth. Both MCP server and API key provider consume the same Zod schemas. Prevents drift. |
| History | Provider-internal `messages[]` | chatStore-managed | API format (`role/content` with `tool_use`/`tool_result` blocks) differs from UI format (`ChatMessage` with `events[]`). Same pattern as WebSocketProvider (stateless re: chatStore). |
| Model selection | Curated dropdown | User-typed model ID / Hardcoded | Discoverable for users, avoids typos, easily updatable. |
| Key storage | localStorage via `apiKeyStore` | In-memory only / Server-side | Pragmatic for client-side app. Key is already exposed in browser DevTools network tab. Wrapped in proper settings UI with security messaging. |
| Settings UI | Separate "AI Settings" dialog | Expand Appearance dialog | AI settings are contextually related to chat panel, not appearance. Discoverable from where the user interacts with AI. |
| Provider visibility | Always visible in selector | Only after key configured | Discoverability — seeing "Claude (API Key)" teaches users the option exists. Gray dot + click-to-configure is intuitive. |

---

## Design

### 1. Shared Tool Definitions

**New file**: `src/core/ai/toolDefs.ts`

Pure metadata module — contains only tool names, descriptions, and Zod schemas. **Must not** import from `@anthropic-ai/claude-agent-sdk` or any Node.js-only module (this file is bundled into the browser build). Uses `zod` directly (already a browser dependency).

```typescript
import { z } from 'zod/v4';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
}

export const archCanvasToolDefs: ToolDef[] = [
  { name: 'add_node', description: '...', inputSchema: z.object({ ... }) },
  { name: 'add_edge', description: '...', inputSchema: z.object({ ... }) },
  // ... all tools
];
```

**New file**: `src/core/ai/translateToolArgs.ts`

Extracted arg translation logic — shared by both `mcpTools.ts` and `apiKeyProvider.ts`. Contains runtime logic including `parseCanvas` import for `import_yaml` handling.

```typescript
import { parseCanvas } from '../../storage/yamlCodec';

/** Map tool name → dispatcher action name */
export const TOOL_TO_ACTION: Record<string, string> = {
  add_node: 'addNode',
  add_edge: 'addEdge',
  remove_node: 'removeNode',
  remove_edge: 'removeEdge',
  import_yaml: 'import',
  create_subsystem: 'createSubsystem',
  add_entity: 'addEntity',
  remove_entity: 'removeEntity',
  update_entity: 'updateEntity',
  list: 'list',
  describe: 'describe',
  search: 'search',
  catalog: 'catalog',
};

/**
 * Translate raw tool args into dispatcher-ready format.
 * Handles: scope→canvasId, flat edge→nested edge, YAML→pre-parsed, etc.
 */
export function translateToolArgs(
  toolName: string,
  args: Record<string, unknown>,
): { action: string; translatedArgs: Record<string, unknown> }
```

**Modified file**: `src/core/ai/mcpTools.ts`

Refactor to consume shared `toolDefs` for metadata and `translateToolArgs` for arg translation. The MCP-specific relay wrapper (`toCallToolResult`, `relay()` calls) stays in `mcpTools.ts`. The tool registration loop uses the existing SDK MCP server API — the refactor changes where the name/description/schema come from, not how they're registered.

### 2. ApiKeyProvider

**New file**: `src/core/ai/apiKeyProvider.ts`

Implements `ChatProvider`:

```typescript
export class ApiKeyProvider implements ChatProvider {
  readonly id = 'claude-api-key';
  readonly displayName = 'Claude (API Key)';

  private messages: MessageParam[] = [];  // API-format conversation history
  private abortController: AbortController | null = null;

  get available(): boolean {
    return useApiKeyStore.getState().isValidated;
  }

  async *sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent> {
    const requestId = ulid();  // Attached to every yielded ChatEvent
    // 1. Build Anthropic client from apiKeyStore
    // 2. Build system prompt via buildSystemPrompt(context)
    // 3. Append user message to this.messages
    // 4. Tool loop: stream → execute → loop
    // 5. Yield ChatEvents with requestId throughout
  }

  loadHistory(_messages: ChatMessage[]): void {
    // Clear internal messages array. Start fresh conversation.
    // No reconstruction from ChatMessage format — conversation context
    // is per-provider, per-session. Switching providers loses context.
    this.messages = [];
  }

  interrupt(): void {
    // Abort via AbortController — streaming fetch throws AbortError
    this.abortController?.abort();
    this.abortController = null;
  }
}
```

#### Tool Loop

```
while true:
  1. Call client.messages.create({
       model: apiKeyStore.model,
       max_tokens: MODEL_MAX_TOKENS[model],  // per-model defaults (see below)
       system: buildSystemPrompt(context),
       messages: this.messages,
       tools: toolDefsAsJsonSchema,  // from toolDefs, converted via zodToJsonSchema
       stream: true,
     })
  2. Process stream events (all yielded ChatEvents include requestId):
     - content_block_delta (text_delta) → yield { type: 'text', requestId, content }
     - content_block_start (tool_use) → accumulate tool input
     - content_block_delta (input_json_delta) → accumulate tool input
     - content_block_stop (tool_use) → yield { type: 'tool_call', requestId, name, args, id }
     - message_stop → check stop_reason
  3. If stop_reason === 'tool_use':
     - For each tool_use block:
       a. Call translateToolArgs(toolName, args)
       b. Execute via dispatchStoreAction(action, translatedArgs)
       c. Yield { type: 'tool_result', requestId, id, result, isError }
     - Append assistant message + tool_result user message to this.messages
     - Continue loop
  4. If stop_reason === 'end_turn' or 'max_tokens':
     - Append assistant message to this.messages
     - Yield { type: 'done', requestId }
     - Break
```

#### Per-Model Max Tokens

```typescript
const MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-6-20250919': 16384,
  'claude-sonnet-4-6-20250919': 16384,
  'claude-haiku-4-5-20251001': 8192,
};
```

#### Extended Thinking

Deferred. Not enabled in v1 of this provider. The `thinking_delta` stream event handling is not included. If extended thinking is added later, it requires `thinking: { type: 'enabled', budget_tokens: N }` in the API call and would be gated behind a settings toggle.

#### Conversation History Management

The internal `messages[]` array grows with each turn. To avoid exceeding the model's context window:

- **On `BadRequestError` with context length message**: Truncate the oldest non-system messages (keeping the first user message for context), retry once. If retry also fails, yield error.
- **No proactive token counting** in v1 — the API error is the signal. This is simpler and avoids maintaining a token counting library.
- **`loadHistory()` clears the array** — starting a new conversation resets history.

#### Provider Switching

When the user switches providers mid-conversation:
- The internal `messages[]` is preserved on the `ApiKeyProvider` instance (not destroyed)
- If the user switches back, they resume with their conversation context intact
- If an API call is in-flight during switch, `chatStore` won't iterate the generator further (the `isStreaming` guard prevents new calls). The in-flight stream will complete or timeout naturally. The `interrupt()` method is available if cleanup is needed.

#### Interruption

- `interrupt()` calls `abortController.abort()`
- The streaming `fetch` throws `AbortError`
- The generator catches it and yields `{ type: 'done', requestId }` (graceful stop)
- Internal message history is preserved up to the interruption point

#### Error Handling

- `AuthenticationError` → yield `{ type: 'error', requestId, message: 'Invalid API key' }`, set `apiKeyStore.isValidated = false`
- `RateLimitError` → yield `{ type: 'rate_limit', requestId }`, SDK auto-retries (2 retries default)
- `BadRequestError` (context length) → truncate history and retry once, then yield error
- `APIError` (other) → yield `{ type: 'error', requestId, message }` with error details
- Tool execution error → send `tool_result` with `is_error: true`, let Claude handle gracefully

### 3. apiKeyStore

**New file**: `src/store/apiKeyStore.ts`

```typescript
interface ApiKeyState {
  apiKey: string | null;
  model: string;
  isValidated: boolean;
  isValidating: boolean;
  error: string | null;

  setApiKey(key: string): void;
  setModel(model: string): void;
  clearApiKey(): void;
  validateKey(): Promise<boolean>;
}
```

**Persistence**: `apiKey` and `model` persisted to localStorage under `archcanvas:apiKey` and `archcanvas:model`. Key stored as-is (not encrypted — localStorage is not a secure store, but it's the standard pattern for browser "bring your own key" apps).

**Validation**: `validateKey()` creates a temporary Anthropic client and calls `client.models.list()` (free, no token cost). On success, sets `isValidated = true`. On `AuthenticationError`, sets `isValidated = false, error = 'Invalid API key'`.

**Re-registration pattern**: The `useAiProvider` hook subscribes to `apiKeyStore` state changes using a manual comparison pattern (not `subscribeWithSelector` middleware):

```typescript
const unsub = useApiKeyStore.subscribe((state, prev) => {
  if (state.isValidated !== prev.isValidated) {
    chatStore.registerProvider(apiKeyProvider);
  }
});
```

**Model options** (curated list with latest aliases):

```typescript
export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6-20250919', label: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6-20250919', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
] as const;

export const DEFAULT_MODEL = 'claude-sonnet-4-6-20250919';
```

Note: Model IDs with date suffixes will need periodic updates as new models release. This is acceptable for v1 — a dynamic model list can be added later.

### 4. AiSettingsDialog

**New file**: `src/components/AiSettingsDialog.tsx`

**State management**: Dialog open/close state managed via `uiStore` (following the `AppearanceDialog` pattern):
- `showAiSettingsDialog: boolean`
- `openAiSettingsDialog(): void`
- `closeAiSettingsDialog(): void`

Opened via a gear icon button in the chat panel header (next to `ChatProviderSelector`).

**Layout**:

```
┌─ AI Settings ─────────────────────────────┐
│                                            │
│  API Key                                   │
│  ┌──────────────────────────────┐          │
│  │ sk-ant-api03-...••••••••••   │  Clear   │
│  └──────────────────────────────┘          │
│  ⚠ Key is stored in your browser's         │
│    local storage. Use your own key only.   │
│                                            │
│  Model                                     │
│  ┌──────────────────────────────┐          │
│  │ Claude Sonnet 4.6         ▼  │          │
│  └──────────────────────────────┘          │
│                                            │
│  [Test Connection]     ✓ Connected         │
│                                            │
│                              [Close]       │
└────────────────────────────────────────────┘
```

**Behaviors**:
- API key input: masked after save (shows first 12 chars + `••••`). Type to replace.
- Model dropdown: curated list from `AVAILABLE_MODELS`
- "Test Connection" button: calls `apiKeyStore.validateKey()`. Shows spinner during validation, green checkmark on success, red error on failure.
- "Clear" button: calls `apiKeyStore.clearApiKey()`, removes from localStorage
- Warning text about client-side storage always visible
- Dialog uses `@radix-ui/react-dialog` (already a dependency)
- Animations gated by `useReducedMotion()`

### 5. Provider Registration

**Modified file**: `src/components/hooks/useAiProvider.ts`

Register both providers on mount:

```typescript
export function useAiProvider() {
  useEffect(() => {
    // Existing: WebSocket Claude Code provider
    const wsProvider = new WebSocketClaudeCodeProvider();
    chatStore.registerProvider(wsProvider);
    // ... existing connection logic

    // New: API key provider (always registered)
    const apiKeyProvider = new ApiKeyProvider();
    chatStore.registerProvider(apiKeyProvider);

    // Re-register on apiKeyStore validation state change
    const unsub = useApiKeyStore.subscribe((state, prev) => {
      if (state.isValidated !== prev.isValidated) {
        chatStore.registerProvider(apiKeyProvider);
      }
    });

    return () => {
      wsProvider.disconnect();
      unsub();
    };
  }, []);
}
```

### 6. ChatProviderSelector Enhancement

**Modified file**: `src/components/panels/ChatProviderSelector.tsx`

When the user selects a provider with `available === false`:
- If it's the API key provider (`id === 'claude-api-key'`) → open `AiSettingsDialog` via `uiStore.openAiSettingsDialog()` instead of switching provider
- After successful key validation in the dialog → auto-select the API key provider via `chatStore.setActiveProvider('claude-api-key')`
- Other unavailable providers → show "Not available" tooltip (existing behavior)

### 7. System Prompt

The API key provider uses the same `buildSystemPrompt(context)` as the bridge — no changes needed. The system prompt describes the tools generically; it doesn't reference the Claude Code SDK or bridge.

---

## Files Changed

| File | Change |
|------|--------|
| `src/core/ai/toolDefs.ts` | **New** — shared tool name/description/schema array (pure metadata, browser-safe) |
| `src/core/ai/translateToolArgs.ts` | **New** — shared arg translation logic + `TOOL_TO_ACTION` map |
| `src/core/ai/apiKeyProvider.ts` | **New** — `ApiKeyProvider` class implementing `ChatProvider` |
| `src/store/apiKeyStore.ts` | **New** — Zustand store for API key, model, validation state |
| `src/components/AiSettingsDialog.tsx` | **New** — settings dialog for key + model + test |
| `src/core/ai/mcpTools.ts` | Refactor to consume shared `toolDefs` + `translateToolArgs` |
| `src/store/uiStore.ts` | Add `showAiSettingsDialog` / `openAiSettingsDialog` / `closeAiSettingsDialog` |
| `src/components/hooks/useAiProvider.ts` | Register `ApiKeyProvider` alongside WebSocket provider |
| `src/components/panels/ChatProviderSelector.tsx` | Open settings dialog when selecting unavailable API key provider, auto-select after validation |
| `package.json` | Add `@anthropic-ai/sdk` dependency |

## Tests

| File | Coverage |
|------|----------|
| `test/ai/toolDefs.test.ts` | Shared defs: all tools have name/description/schema, no Node.js-only imports |
| `test/ai/translateToolArgs.test.ts` | All tools: name→action mapping, arg translation (scope→canvasId, flat edge→nested, YAML parsing for import_yaml), missing fields, wrong types, default scope fallback |
| `test/ai/apiKeyProvider.test.ts` | Tool loop: single turn, multi-turn with tools, streaming events with requestId, tool execution via mock `dispatchStoreAction`, interrupt/abort, error handling (auth→invalidates key, rate limit, context length→truncate+retry, general API error), tool result with `is_error`, `import_yaml` YAML parsing, provider switching preserves history, concurrent sendMessage guard |
| `test/store/apiKeyStore.test.ts` | `setApiKey`/`clearApiKey` + localStorage persistence, `setModel` + persistence, `validateKey` via models.list success/failure, `isValidated` reactivity |
| `test/components/AiSettingsDialog.test.tsx` | Key input + masking, model dropdown, test connection button states, clear button, warning text visibility, dialog open/close via uiStore |
| `test/e2e/api-key-provider.spec.ts` | E2E: configure key → select provider → send message → verify tool execution + response rendering. Mock at SDK client level via DI (inject mock `Anthropic` constructor), consistent with existing mock patterns (mockSessionFactory). |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Anthropic Messages API client with browser CORS support |

## Scope

- ~600-800 lines production code (provider + store + dialog + shared defs + arg translation)
- ~500-600 lines tests
- 5 new files, 4 modified files
- 1 new dependency
