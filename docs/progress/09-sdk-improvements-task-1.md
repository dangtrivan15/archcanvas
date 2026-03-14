# 09: SDK Improvements — Task 1 (Types & Bridge Core)

> **Date**: 2026-03-14 | **Status**: Complete
> **Scope**: Expand the AI bridge type system and SDK plumbing to support the full Claude Agent SDK capabilities

## Recap

Task 1 is the foundation layer of the I6a SDK Improvements feature — a 5-task effort to align ArchCanvas's ClaudeCodeProvider bridge with the full Agent SDK surface area. This task expands types, bridge options, and transport wiring so that the subsequent UI tasks (T2–T5) can consume the new capabilities without touching the plumbing.

The work started from a systematic gap analysis comparing the current implementation against the [Agent SDK documentation](https://platform.claude.com/docs/en/agent-sdk/overview#built-in-tools), which identified 12 improvements. These were decomposed into 5 tasks with a dependency graph (T1 → T2/T3/T4/T5 parallel), and T1 was further broken down into a 12-step implementation plan organized in 3 chunks.

**What was built (13 commits, 4 source files + 4 test files, ~19 new tests):**

- **Chunk 1 — Type expansions** (`src/core/ai/types.ts`): `PermissionRequestEvent` gained `blockedPath?` and `decisionReason?` fields. New `StatusEvent` and `RateLimitEvent` added to the `ChatEvent` union. `PermissionResponseClientMessage` expanded with `updatedPermissions?` and `interrupt?`. New `SetPermissionModeClientMessage` and `SetEffortClientMessage` added to the `ClientMessage` union.

- **Chunk 2 — Bridge core** (`src/core/ai/claudeCodeBridge.ts`): `SDKQueryFn` type expanded to match full SDK `Options` shape (hooks, toolConfig, effort, maxTurns, enriched canUseTool). `BridgeSession` gained `setPermissionMode()` and `setEffort()` session-level methods. `allowedTools` expanded from 5 to 9 (added Write, Edit, WebFetch, WebSearch). `maxTurns: 50` safety guard, `includePartialMessages: true`, `toolConfig: { askUserQuestion: { previewFormat: 'markdown' } }`. `PendingPermission` refactored from boolean to `{ allowed, updatedPermissions?, interrupt? }`. PreToolUse auto-approve hook for Read/Glob/Grep.

- **Chunk 3 — Transport layer** (`vitePlugin.ts`, `webSocketProvider.ts`): New switch cases for `set_permission_mode` and `set_effort` client messages. `permission_response` handler now forwards `updatedPermissions` and `interrupt`. `sendSetPermissionMode()` and `sendSetEffort()` methods on the browser-side provider. `unhandledRejection` listener leak fix (extracted to named ref with `process.off` on server close).

**Test count**: 829 tests (up from 809), all passing. `tsc --noEmit` clean.

**What's next**: Tasks 2–5 can now execute in parallel — Permission Card UX (T2), Streaming & SDK message types (T3), UI Controls for mode/effort (T4), and Question Previews (T5).

**Plans**: [`docs/plans/2026-03-14-i6a-sdk-improvements-index.md`](../plans/2026-03-14-i6a-sdk-improvements-index.md) (task index), [`docs/superpowers/plans/2026-03-14-i6a-sdk-task-1.md`](../superpowers/plans/2026-03-14-i6a-sdk-task-1.md) (detailed implementation plan)

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| `canUseToolCallback` type in tests | `any` cast | Narrow function type annotation | Expanding `SDKQueryFn` changes the canUseTool signature, which breaks 4 existing narrow type annotations. Using `any` is safe here because the tests immediately invoke the callback with specific arguments — correctness is verified at runtime, not compile-time |
| `setEffort` parameter type | `string` (cast internally) | `'low' \| 'medium' \| 'high' \| 'max'` literal union | The `BridgeSession` interface uses `string` to match the `SetEffortClientMessage` transport type. The cast to the literal union happens at the boundary inside `setEffort()`. This avoids coupling the transport layer to SDK-specific literal types |
| `PermissionResponseClientMessage.permission` | `'allow'` literal | `string` | More restrictive at the client message level — the SDK only accepts `'allow'` as a permission value. The bridge internally uses `string` for flexibility, but the client-facing type is intentionally narrow |
| `unhandledRejection` cleanup | `httpServer.on('close')` | Vite `closeBundle` hook | The HTTP server's `close` event mirrors the lifecycle of `configureServer` more precisely. `closeBundle` fires during build, not dev server shutdown. The `close` event also fires in test teardown (`stopServer()`), preventing listener accumulation |
| Plan chunk granularity | 3 chunks (types / bridge / transport) | 12 individual tasks | The 12 plan steps within each chunk are tightly coupled and sequential. Dispatching 12 subagents + 24 reviewers would be excessive overhead. 3 chunks (3 implementers + 6 reviewers + 1 fix round) balanced thoroughness with efficiency |

## Retrospective

- **What went well** — The subagent-driven development workflow with two-stage review (spec compliance → code quality) caught real issues at each stage. The code quality reviewer for Chunk 3 found the `unhandledRejection` listener leak — a subtle production bug that would have caused `MaxListenersExceededWarning` in development and unbounded listener growth on HMR restarts. The Chunk 2 spec reviewer verified all 6 tasks line-by-line against requirements, confirming zero deviations. Grouping the 12 plan steps into 3 chunks was the right call — it gave each subagent enough context to work effectively without overwhelming any single dispatch.

- **What didn't** — The TS language server (LSP) diagnostics were consistently unreliable during this session. Multiple rounds of "false positive" TypeScript errors appeared in the diagnostic stream (unused imports, missing methods, type mismatches) that `tsc --noEmit` did not reproduce. This caused one unnecessary resume of an implementer subagent to "fix" errors that didn't exist. The root cause is that the LSP processes file changes asynchronously and can report stale state, especially when subagents edit files rapidly. Lesson: always verify LSP diagnostics with `tsc --noEmit` before acting on them.

- **Lessons** — (1) For type-expansion tasks, TDD with Vitest has a fidelity gap: esbuild transpilation doesn't run type checking, so adding unknown fields to typed objects won't fail at runtime. The "failing test" step only manifests via `tsc`, not `vitest run`. The implementer noted this correctly. (2) Pre-existing uncommitted changes in the working tree complicate worktree isolation — worktrees branch from HEAD (committed state), so they'd miss the I6a base implementation. Working directly on the current branch was the pragmatic choice. (3) When reviewing subagent output, distinguish between issues introduced by the subagent vs. pre-existing code that happened to be committed alongside the new work (e.g., the AskUserQuestion types were from I6a, not from our Chunk 1 implementer).

- **Notes for future** — `sendPermissionResponse()` in `webSocketProvider.ts` still only accepts `(id, allowed)` — it doesn't forward `updatedPermissions` or `interrupt` to the server. This means the "Always Allow" and "Deny & Stop" UI paths (Task 2) will need to either expand this method signature or add a new method. The code quality reviewer flagged this; it's tracked in the T2 scope.
