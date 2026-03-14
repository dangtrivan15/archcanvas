# Permission Suggestions Fix — Design Spec

**Date**: 2026-03-14
**Status**: Draft
**Scope**: Fix "Always Allow" persistence + add editable suggestion UI

---

## Problem

Two bugs in the current permission flow:

1. **Wrong `updatedPermissions` shape** — `ChatPermissionCard` sends `{ tool, permission: 'allow' }` when clicking "Always Allow", but the SDK expects a discriminated union: `{ type: 'addRules', rules: [...], behavior: 'allow', destination: 'localSettings' }`. The SDK's Zod validation uses `.catch()` on `updatedPermissions`, which **silently drops** malformed objects with only a warn-level log. This makes the bug invisible — "Always Allow" appears to work but persists nothing.

2. **SDK suggestions are dropped** — The SDK computes tool-appropriate `permission_suggestions` in the `canUseTool` callback's `opts` parameter (e.g., `npm test:*` for Bash, directory paths for file tools). We never forward these to the UI.

Additionally, the user should be able to **edit the rule pattern** before confirming "Always Allow", giving control over how broad or narrow the permission grant is.

## Current Data Flow

```
SDK canUseTool(toolName, input, opts)
  → opts.suggestions available but DROPPED
  → bridge emits permission_request { id, tool, command, blockedPath, decisionReason }
  → WebSocket → browser
  → ChatPermissionCard renders 4 buttons
  → "Always Allow" sends { tool, permission: 'allow' }  ← WRONG SHAPE
  → SDK Zod .catch() silently drops → nothing persisted
```

## Proposed Data Flow

```
SDK canUseTool(toolName, input, opts)
  → opts.suggestions forwarded as permissionSuggestions
  → bridge emits permission_request { ..., permissionSuggestions }
  → WebSocket → browser
  → ChatPermissionCard shows 4 buttons
  → "Always Allow" expands chip selector with SDK suggestions
  → user selects/edits a suggestion, clicks "Confirm"
  → sends SDK-shaped PermissionSuggestion[] as updatedPermissions
  → SDK processes via AC() → Su() → writes to .claude/local.settings.json
```

## Type Definitions

### New: `PermissionSuggestion`

```ts
/**
 * SDK permission suggestion — a discriminated union matching the SDK's Zod
 * schema (ig6/oR1). We support the two variants that appear in practice:
 * 'addRules' (Bash, WebFetch, WebSearch, MCP, Skills) and 'addDirectories'
 * (file tools with blockedPath).
 *
 * The SDK also defines 'replaceRules', 'removeRules', 'setMode', and
 * 'removeDirectories', but these never appear in permission suggestions.
 * If the SDK adds new suggestion types in the future, they'll pass through
 * as opaque objects (the bridge treats them as `unknown` and forwards them).
 */
export type PermissionSuggestion =
  | {
      type: 'addRules';
      rules: Array<{ toolName: string; ruleContent?: string }>;
      behavior: 'allow' | 'deny' | 'ask';
      destination: string;  // SDK uses 'localSettings' | 'session' | 'userSettings' | 'projectSettings' | 'cliArg'
    }
  | {
      type: 'addDirectories';
      directories: Array<string>;
      destination: string;
    };
```

**Design decisions:**
- `destination` is `string` (not a narrow union) so we forward whatever the SDK sends without risk of Zod mismatch. In practice it's almost always `'localSettings'` or `'session'`.
- `behavior` on `addRules` is `'allow' | 'deny' | 'ask'` to match the SDK's full enum. The UI only acts on `'allow'` suggestions but won't reject others.
- `addDirectories` has no `behavior` field — it grants access to directories for file tools.
- Both types are opaque to the bridge/store layers — they just pass through. Only the UI inspects them.

**Important**: The SDK's allow response Zod schema (`SHz`) requires `updatedInput` to be present (not optional) when `behavior` is `'allow'`. The bridge already passes `updatedInput: input` (since our earlier fix). Any future changes must preserve this.

### SDK Suggestion Patterns by Tool

The SDK computes these — we forward them. The suggestion `type` varies by tool:

| Tool | Suggestion type | Content | Example |
|------|----------------|---------|---------|
| Bash | `addRules` | `ruleContent` = command prefix + `:*` or exact command | `npm test:*`, `echo hello` |
| Read/Write/Edit (blockedPath) | `addDirectories` | `directories` = [resolved path] | `["/Users/x/project/src"]` |
| Read/Write/Edit (no blockedPath) | `addRules` | `ruleContent` = path glob | `/src/**` |
| WebFetch | `addRules` | `ruleContent` = `domain:hostname` | `domain:example.com` |
| WebSearch | `addRules` | no `ruleContent` (tool-level) | `{ toolName: "WebSearch" }` |
| MCP tools | `addRules` | no `ruleContent` (tool-level) | `{ toolName: "mcp__server__tool" }` |
| Skill | `addRules` | `ruleContent` = skill name or `name:*` | `commit`, `commit:*` |

## Layer-by-Layer Changes

### Layer 1: Types — `src/core/ai/types.ts`

1. Export `PermissionSuggestion` type (union, defined above)
2. Add `permissionSuggestions?: PermissionSuggestion[]` to `PermissionRequestEvent`
3. Change `PermissionResponseClientMessage.updatedPermissions` from `Array<{ tool: string; permission: 'allow' }>` to `PermissionSuggestion[]`

### Layer 2: Bridge — `src/core/ai/claudeCodeBridge.ts`

1. **`SDKQueryFn` type** (~line 57): change `suggestions` in the opts parameter from `Array<{ tool; permission }>` to `PermissionSuggestion[]`
2. **`SDKQueryFn` return type** (~line 63): change `updatedPermissions` from `Array<{ tool; permission }>` to `PermissionSuggestion[]`
3. **`OnPermissionRequest` type** (~line 133): add `permissionSuggestions?: PermissionSuggestion[]` to the event shape
4. **`PermissionResponse` interface** (~line 105): change `updatedPermissions` from `Array<{ tool; permission }>` to `PermissionSuggestion[]`
5. **`BridgeSession.respondToPermission`** (~line 84): change options `updatedPermissions` type to `PermissionSuggestion[]`
6. **`canUseTool` callback** (~line 481-490): forward `opts.suggestions` as `permissionSuggestions` in the `onPermissionRequest` call. Note: the field name in the `canUseTool` callback opts is `suggestions` (camelCase), not `permission_suggestions` (the SDK maps the wire format internally).

### Layer 3: WebSocket Provider — `src/core/ai/webSocketProvider.ts`

1. **`sendPermissionResponse`** (~line 113): change options `updatedPermissions` type from `Array<{ tool; permission }>` to `PermissionSuggestion[]`

### Layer 4: Vite Plugin — `src/core/ai/vitePlugin.ts`

1. **`permission_response` handler** (~line 340): no code change needed — already passes `permMsg.updatedPermissions` through. Type change flows from `PermissionResponseClientMessage`.
2. **`onPermissionRequest` callback** (~line 251): no code change needed — already serializes the full event object. The new `permissionSuggestions` field flows through.

### Layer 5: Chat Store — `src/store/chatStore.ts`

1. **`respondToPermission`** (~line 29, ~line 221): change `updatedPermissions` option type from `Array<{ tool; permission }>` to `PermissionSuggestion[]`

### Layer 6: ChatMessage — `src/components/panels/ChatMessage.tsx`

1. Pass `permissionSuggestions` from the `PermissionRequestEvent` to `ChatPermissionCard` (~line 96-103)

### Layer 7: ChatPermissionCard — `src/components/panels/ChatPermissionCard.tsx`

This is the main UI change.

#### Updated Props

```ts
interface Props {
  id: string;
  tool: string;
  command: string;
  blockedPath?: string;
  decisionReason?: string;
  permissionSuggestions?: PermissionSuggestion[];
}
```

#### UI Behavior

**Initial state**: Same as today — 4 buttons (Approve, Always Allow, Deny, Deny & Stop).

**When "Always Allow" is clicked**:

1. Buttons hide
2. A suggestion selector area appears:
   - Each SDK suggestion rendered as a **selectable chip** showing a human-readable label (see label helper below)
   - First chip auto-selected
   - A **"Custom..."** chip that, when selected, reveals a text input pre-filled with the selected suggestion's editable content
   - User can edit the text input to modify the pattern
3. Two action buttons below chips:
   - **"Confirm"** — sends the selected (possibly edited) suggestion as `updatedPermissions`
   - **"Cancel"** — collapses back to the original 4 buttons

**When no suggestions exist** (unlikely but defensive):
- "Always Allow" immediately sends a fallback: `[{ type: 'addRules', rules: [{ toolName: tool }], behavior: 'allow', destination: 'localSettings' }]` — tool-level allow with no `ruleContent`.

#### Chip Label Helper

```ts
function suggestionLabel(suggestion: PermissionSuggestion): string {
  if (suggestion.type === 'addDirectories') {
    return suggestion.directories.join(', ') || '(no directories)';
  }
  // addRules
  if (suggestion.rules.length === 0) return `${suggestion.rules[0]?.toolName ?? 'tool'} (any)`;
  const rule = suggestion.rules[0];
  return rule.ruleContent ?? `${rule.toolName} (any)`;
}
```

This shows:
- `addDirectories`: the directory paths (e.g., `/Users/x/project/src`)
- `addRules` with `ruleContent`: the pattern (e.g., `npm test:*`)
- `addRules` without `ruleContent`: `Bash (any)` — tool-level allow

#### Custom Edit Flow

When the "Custom..." chip is selected:

1. Text input appears, pre-filled with the editable content from the first suggestion:
   - For `addRules`: the `ruleContent` value
   - For `addDirectories`: the first directory path
2. On confirm, the custom value builds a new suggestion:
   - For `addRules`: `{ type: 'addRules', rules: [{ toolName: tool, ruleContent: editedValue }], behavior: 'allow', destination: 'localSettings' }`
   - For `addDirectories`: `{ type: 'addDirectories', directories: [editedValue], destination: 'localSettings' }`
3. If the user clears the text input entirely and the original was `addRules`, it becomes a tool-level allow (no `ruleContent`)

## State Machine

```
[pending] → click "Always Allow" → [selecting] (if suggestions exist)
[pending] → click "Always Allow" → [always] (if no suggestions, send fallback)
[selecting] → click chip → [selecting] (update selection)
[selecting] → click "Custom..." → [editing] (show text input)
[editing] → type in input → [editing] (update custom value)
[editing] → click chip → [selecting] (hide text input)
[selecting/editing] → click "Confirm" → [always] (send response)
[selecting/editing] → click "Cancel" → [pending] (back to buttons)
[pending] → click "Approve" → [approved]
[pending] → click "Deny" → [denied]
[pending] → click "Deny & Stop" → [interrupted]
```

## Testing

### Bridge Tests (`test/ai/bridge.test.ts`)

1. **Update existing tests**: Change `updatedPermissions` assertions to use `PermissionSuggestion` shape
2. **New test**: Verify `permissionSuggestions` from SDK `opts.suggestions` are forwarded through `onPermissionRequest`
3. **New test**: Verify `updatedPermissions` in the allow response uses SDK-shaped objects
4. **New test**: Verify `addDirectories` suggestions pass through correctly

### ChatPermissionCard Tests (new file or extend existing)

1. Renders suggestion chips when `permissionSuggestions` provided
2. Renders `addDirectories` suggestions with directory path labels
3. First chip auto-selected on "Always Allow" click
4. "Custom..." chip reveals text input
5. Editing text input updates the custom ruleContent
6. "Confirm" sends correct `PermissionSuggestion[]` via `respondToPermission`
7. "Cancel" returns to initial button state
8. Fallback when no suggestions: sends tool-level `addRules` allow
9. Handles empty `rules` array gracefully (no crash)

## Files Modified

| File | Change |
|------|--------|
| `src/core/ai/types.ts` | Add `PermissionSuggestion`, update `PermissionRequestEvent`, `PermissionResponseClientMessage` |
| `src/core/ai/claudeCodeBridge.ts` | Update types, forward `opts.suggestions` as `permissionSuggestions` |
| `src/core/ai/webSocketProvider.ts` | Update `sendPermissionResponse` type |
| `src/core/ai/vitePlugin.ts` | Type changes flow through (minimal code change) |
| `src/store/chatStore.ts` | Update `respondToPermission` type |
| `src/components/panels/ChatMessage.tsx` | Pass `permissionSuggestions` to `ChatPermissionCard` |
| `src/components/panels/ChatPermissionCard.tsx` | New chip selector UI, editable custom input |
| `test/ai/bridge.test.ts` | Update existing + add new permission suggestion tests |

## Out of Scope

- Supporting SDK suggestion types beyond `addRules` and `addDirectories` (e.g., `setMode`, `replaceRules`, `removeRules`) — these never appear in permission suggestions in practice
- Persisting "deny" rules — the SDK supports `behavior: 'deny'` in `addRules` but our UI only has "Always Allow", not "Always Deny"
- Showing suggestion chips for "Approve" (one-time allow) — suggestions only matter for persistent rules
