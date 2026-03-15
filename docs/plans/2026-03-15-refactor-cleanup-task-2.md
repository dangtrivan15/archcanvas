# Task 2: chatStore Type-Safe Provider Delegation + Rate-Limit Warning

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Eliminate `as any` casts in chatStore + fix rate-limit/error overlap
**Parent feature:** [Phase 13 Index](./2026-03-15-refactor-cleanup-index.md)

## Write Set

- Modify: `src/core/ai/types.ts` (~+15 lines — add `InteractiveChatProvider` interface)
- Modify: `src/store/chatStore.ts` (~40 lines changed — type guard + warning field)
- Modify: `src/components/panels/ChatPanel.tsx` (~+10 lines — render warning banner)
- Modify: `test/store/chatStore.test.ts` (~+40 lines — warning field tests)
- Modify: `test/components/chatPanel.test.tsx` (~+15 lines — warning banner test)

## Read Set (context needed)

- `src/core/ai/types.ts` — current `ChatProvider` interface, `ChatEvent` union
- `src/store/chatStore.ts` — current duck-typing pattern (4× `as any` casts)
- `src/core/ai/webSocketProvider.ts:128-163` — the 4 methods being duck-typed
- `src/components/panels/ChatPanel.tsx` — current error banner rendering
- `test/store/chatStore.test.ts` — existing tests (must still pass)
- `test/components/chatPanel.test.tsx` — existing ChatPanel tests

## Dependencies

- **Blocked by:** Nothing (independent)
- **Blocks:** Task 5 (rename will touch chatStore.ts)

## Description

### Problem 1: Duck-typing boilerplate

`chatStore.ts` has 4 methods that check for WebSocket-specific methods using `in` operator and `as any` casts:

```typescript
// Current pattern (×4):
if ('sendPermissionResponse' in provider && typeof (provider as any).sendPermissionResponse === 'function') {
  (provider as any).sendPermissionResponse(id, allowed, options);
}
```

### Solution: `InteractiveChatProvider` interface

Add a sub-interface of `ChatProvider` to `types.ts` that declares the interactive methods. Then use a type guard in chatStore:

```typescript
// src/core/ai/types.ts — add after ChatProvider interface:

/**
 * Extended provider interface for interactive chat (permissions, questions,
 * settings). WebSocketClaudeCodeProvider implements this; future ApiKeyProvider
 * may not. chatStore uses isInteractiveProvider() to safely narrow.
 */
export interface InteractiveChatProvider extends ChatProvider {
  sendPermissionResponse(
    id: string,
    allowed: boolean,
    options?: { updatedPermissions?: PermissionSuggestion[]; interrupt?: boolean },
  ): void;
  sendQuestionResponse(id: string, answers: Record<string, string>): void;
  sendSetPermissionMode(mode: string): void;
  sendSetEffort(effort: string): void;
}

/** Type guard: narrows ChatProvider to InteractiveChatProvider. */
export function isInteractiveProvider(p: ChatProvider): p is InteractiveChatProvider {
  return 'sendPermissionResponse' in p;
}
```

Then in chatStore, replace all 4 duck-type blocks with:

```typescript
import { isInteractiveProvider } from '@/core/ai/types';

// Before: 4 lines with as any
// After: 2 lines, fully typed
const provider = providers.get(activeProviderId);
if (provider && isInteractiveProvider(provider)) {
  provider.sendPermissionResponse(id, allowed, options);
}
```

### Problem 2: Rate-limit persists in error banner

When the SDK emits a `rate_limit` event, chatStore writes it to the `error` field (line 193). This shows a red error banner. When the rate limit clears and the conversation completes successfully, the `error` field is NOT cleared — the red banner persists.

### Solution: Separate `warning` field

Add a `warning: string | null` field to `ChatState`. Rate-limit events write to `warning` instead of `error`. The warning is auto-cleared on `done`. The UI renders it as a yellow/amber banner (distinct from the red error banner).

```typescript
// chatStore changes:
interface ChatState {
  // ... existing fields ...
  warning: string | null;  // NEW — for transient warnings like rate limits
}

// In sendMessage initial set() — clear warning alongside error:
set((state) => ({
  messages: [...state.messages, userMessage],
  isStreaming: true,
  error: null,
  warning: null,     // NEW — clear stale warnings on new message
  statusMessage: null,
}));

// In sendMessage event loop:
if (event.type === 'rate_limit') {
  set({ warning: event.message });  // was: set({ error: event.message })
}

if (event.type === 'done') {
  set({ statusMessage: null, warning: null });  // clear warning on completion
}

// In sendMessage finally block — also clear warning:
} finally {
  set({ isStreaming: false, statusMessage: null, warning: null });
}
```

```tsx
// ChatPanel.tsx — add warning banner after error banner:
{warning && !error && (
  <div className="border-b border-amber-800 bg-amber-950/50 px-3 py-1.5 text-xs text-amber-300" role="status">
    {warning}
  </div>
)}
```

### Testing strategy

**chatStore tests:**
1. `rate_limit` event sets `warning` (not `error`)
2. `warning` is cleared on `done` event
3. `warning` is cleared on new `sendMessage`
4. `warning` is cleared on `clearHistory`
5. Real `error` events still set `error` field (not `warning`)
6. `respondToPermission` uses `isInteractiveProvider` (no `as any`)
7. `respondToPermission` is a no-op for bare `ChatProvider` (no crash)
8. Same pattern for `respondToQuestion`, `setPermissionMode`, `setEffort`

**ChatPanel tests:**
1. Warning banner renders with amber styling when `warning` is set
2. Warning banner does not render when `error` is set (error takes priority)
3. Error banner still renders with red styling

### Acceptance criteria

- [ ] `InteractiveChatProvider` interface exists in `types.ts`
- [ ] `isInteractiveProvider` type guard exists in `types.ts`
- [ ] All 4 `as any` casts in chatStore are replaced with `isInteractiveProvider`
- [ ] `warning` field added to `ChatState` (initialized to `null`)
- [ ] Rate-limit events write to `warning`, not `error`
- [ ] `warning` cleared on `done`, new message, and `clearHistory`
- [ ] ChatPanel renders amber warning banner (distinct from red error banner)
- [ ] All existing chatStore + ChatPanel tests pass
- [ ] New tests cover warning lifecycle and type-safe provider delegation
