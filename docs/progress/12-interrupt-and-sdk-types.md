# 12: Interrupt & SDK Type Alignment

> **Date**: 2026-03-15 | **Status**: Complete
> **Scope**: Replace destructive abort with SDK-native interrupt; adopt real SDK types throughout the bridge

## Recap

The AI chat panel had a Stop button and an abort mechanism, but clicking Stop called `AbortController.abort()` which killed the entire Claude Code SDK process. This destroyed session state, causing the next message to start a fresh conversation with no prior context — the opposite of what users expect from a "stop generating" action.

We replaced the entire abort flow with the SDK's native `query.interrupt()` method, discovered during an SDK type audit. The `Query` object returned by `query()` extends `AsyncGenerator` with control methods including `interrupt()`, which cleanly stops the current turn while preserving session state on disk. The browser-side event stream also terminates immediately via a cooperative abort flag in the `createEventStream` generator, so the UI updates instantly without waiting for the server round-trip.

Alongside the interrupt work, we audited all hand-rolled SDK types in the bridge and replaced them with real imports from `@anthropic-ai/claude-agent-sdk`. This collapsed the 40-line `SDKQueryFn` type into 4 lines using `SDKOptions`, replaced our loose `SDKMessage` interface with the SDK's discriminated union, and — critically — surfaced two bugs: a dead `case 'status'` handler (SDK has no `type: 'status'` message; status was actually working via `tool_progress`) and a wrong type name in `case 'rate_limit'` (SDK uses `'rate_limit_event'` with structured `rate_limit_info`, not a simple `message` string).

The project is now ready for I6b (Onboarding Wizard). Test count is 976 (down 2 from dead-code test removal).

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| How to stop a streaming response | SDK's native `query.interrupt()` | `AbortController.abort()` | `abort()` kills the process and destroys session state; `interrupt()` stops the turn while preserving context for resume. Discovered via SDK type audit — the `Query` object exposes this method |
| Browser-side stream termination | Cooperative abort flag in `createEventStream` generator | Relying on server-side termination alone | The server-side interrupt is async (SDK finishes its current operation); the browser needs to stop processing events immediately for responsive UX |
| Pending permissions on interrupt | Auto-deny with `interrupt: true` + resolve pending questions | Leave them hanging | Without resolving pending prompts, the SDK would be stuck waiting for user input that will never come, preventing the turn from finishing cleanly |
| Hard abort (destroy) | Keep `AbortController.abort()` only in `destroy()` | Remove abort entirely | Still needed for hard cleanup when WebSocket disconnects — the session is being torn down anyway |
| SDK type adoption scope | Replace all bridge types with SDK imports | Keep minimal hand-rolled types for test ergonomics | The user wanted full SDK utilization. Test mocks use `as unknown as SDKMessage` casts — acceptable trade-off for catching real type mismatches in production code |
| `PermissionSuggestion` vs `PermissionUpdate` | Cast at bridge boundary | Replace `PermissionSuggestion` globally | `PermissionSuggestion` is a browser/server protocol type used across UI components; changing it would couple browser code to the Node-only SDK package |

## Retrospective

- **What went well** — The SDK type audit was high-value: it collapsed 40 lines of hand-rolled types into 4, and immediately surfaced two latent bugs (`case 'status'` dead code, `case 'rate_limit'` wrong type name). Using the real `SDKMessage` discriminated union gives us proper type narrowing in `translateSDKStream`, catching future drift at compile time.

- **What didn't** — The initial approach focused on making the existing abort work better (browser-side generator termination) before understanding the root cause (session destruction). We should have read the SDK docs first to discover `query.interrupt()`. The SDK docs were also somewhat incomplete — the `Query` object's methods aren't documented in the main TypeScript reference, only discoverable via the `.d.ts` file.

- **Lessons** — When wrapping an SDK, periodically audit whether you're using the SDK's own types and capabilities or maintaining shadow copies that drift. The `SDKMessage` drift (our `{ type: string; [key]: unknown }` vs the real discriminated union) masked bugs for the entire I6a + SDK improvements phase. The Context7 MCP tool was effective for discovering SDK capabilities not obvious from the code.

- **Notes for future** — The `stream_event` case still uses an `as` cast for `BetaRawMessageStreamEvent` because that type comes from `@anthropic-ai/sdk` (the API SDK), not the agent SDK. If we add that dependency, the cast can be removed. The `tool_progress` case currently does nothing — if the SDK adds user-facing content to this message type in the future, we should forward it as a status event.
