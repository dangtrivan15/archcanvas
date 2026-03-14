# 10: SDK Improvements — Tasks 2–5 (Parallel Group)

> **Date**: 2026-03-14 | **Status**: Complete
> **Scope**: Permission Card UX, streaming, UI controls, and question previews — completing the I6a SDK Improvements feature

## Recap

This session completed the remaining 4 tasks of the I6a SDK Improvements feature, building on the Task 1 foundation (types, bridge core, transport) delivered in the previous session. Tasks 2–5 were designed to run in parallel since they touch different UI surfaces, though they share `chatStore.ts` (different methods). They were executed sequentially using subagent-driven development with a three-stage loop per task: implement → spec compliance review → code quality review.

**What was built (5 commits, 8 source files, 4 test files, +1665/−33 lines, 66 new tests):**

- **Task 2 — Permission Card UX** (`ChatPermissionCard.tsx`, `chatStore.ts`, `webSocketProvider.ts`, `ChatMessage.tsx`): Enhanced permission cards with `blockedPath` and `decisionReason` context display, four action buttons (Approve, Always Allow, Deny, Deny & Stop), yellow left-border visual treatment, and full options forwarding (`updatedPermissions`, `interrupt`) through the store→provider→bridge chain.

- **Task 3 — Streaming & SDK Message Types** (`claudeCodeBridge.ts`, `chatStore.ts`, `ChatMessage.tsx`, `ChatPanel.tsx`): Expanded `translateSDKStream` to handle 5 new SDK message types (`stream_event`, `status`, `tool_progress`, `rate_limit`, `prompt_suggestion`). The `hasStreamedText` flag prevents double text emission when `includePartialMessages` is enabled. Added `statusMessage` state to chatStore, `StatusLine` and `RateLimitBadge` UI components, and streaming indicator that shows live status messages.

- **Task 4 — UI Controls** (`chatStore.ts`, `ChatPanel.tsx`): Permission mode dropdown (Default, Auto-edit, Plan only, Strict — `bypassPermissions` intentionally excluded) and effort selector (Quick, Medium, Thorough, Maximum) in the ChatPanel header. Both controls disabled during streaming, styled consistently with `ChatProviderSelector`.

- **Task 5 — Question Previews** (`ChatQuestionCard.tsx`): Preview rendering for AskUserQuestion options — selected options show their markdown preview in a `<pre>` block with `max-height: 200px`, `overflow-y: auto`, and XSS-safe plain text rendering via React's text interpolation. The bridge-side `toolConfig.askUserQuestion.previewFormat` and `PreToolUse` auto-approve hooks were already configured in Task 1; Task 5 verified existing tests and added UI rendering.

**Test count**: 895 tests (up from 829), all passing. `tsc --noEmit` clean.

**What's next**: The I6a SDK Improvements feature is now complete. The next initiative is I6b (Onboarding Wizard), followed by I7 (Packaging + Polish).

**Plans**: [`docs/plans/2026-03-14-i6a-sdk-improvements-index.md`](../plans/2026-03-14-i6a-sdk-improvements-index.md) (5-task index), individual task plans in `docs/plans/2026-03-14-i6a-sdk-task-{2,3,4,5}.md`

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Preview visibility trigger | Show on option selection | Always visible for all options | Avoids visual clutter when multiple options have previews; shows preview only for the option the user is considering |
| `hasStreamedText` scope | Per `translateSDKStream` call | Per assistant message | The SDK consistently emits stream_events before every assistant message when `includePartialMessages: true`, so per-call scoping is sufficient and simpler than per-turn tracking |
| Permission mode UI options | 4 modes (exclude `bypassPermissions`) | All 5 SDK modes | Prevents accidental full-access mode; power users can set it programmatically via the bridge |
| Rate limit display | Write to `error` field (red banner) | Separate `rateLimitMessage` field | The spec explicitly called for "show as a temporary warning in the error field." Creates a dual display (red banner + yellow badge in events) but matches spec intent. Tracked for future UX polish |
| Sequential task execution | One implementer at a time | Parallel implementers with worktrees | Tasks 2, 3, 4 all modify `chatStore.ts`; sequential execution avoids merge conflicts without worktree complexity |

## Retrospective

- **What went well** — The subagent-driven development workflow scaled cleanly to 4 tasks. Every task passed through implement → spec review → code review without needing a re-dispatch of the implementer. The spec reviewers caught real issues: Task 2's accidentally committed `types.d.ts` (fixed immediately) and Task 3's rate_limit/error field dual display (tracked as known UX concern). The code quality reviewers confirmed architectural consistency across all 4 tasks. Total: 12 subagent dispatches, zero re-dispatches, zero blocked tasks.

- **What didn't** — The LSP continued to report false positive diagnostics throughout the session (same issue noted in Task 1's retro). The `@/` path alias resolution failures and stale type information are noise that required mental filtering at each review stage. Additionally, the `chatStore.ts` `respondToPermission`/`respondToQuestion`/`setPermissionMode`/`setEffort` duck-typing pattern now has 4 methods using `as any` casts — the code quality reviewer flagged this as approaching the threshold for extraction into a helper, but we deferred it.

- **Lessons** — (1) When the plan says tasks are "parallel," it means they can be developed independently, not that they should be dispatched simultaneously. Sequential execution with fresh context per task was more reliable than managing merge conflicts across shared files. (2) The spec review stage's highest value is catching things that "work but don't match intent" — like the `.d.ts` commit and the rate_limit dual display. The code quality stage's highest value is identifying patterns that compound (the duck-typing boilerplate). (3) Providing the full current file contents (post previous task) to each implementer eliminated context drift issues.

- **Notes for future** — The duck-typing pattern in `chatStore.ts` should be refactored into a `callProviderMethod` helper before adding more provider-delegating methods. The `error` field being shared between real errors and rate_limit warnings creates a UX issue (red banner persists after successful completion following a rate limit). Consider a separate `warning` field or clearing `error` on `done` when it was set by rate_limit. The `bridge.test.ts` file is at 1294 lines and growing — consider splitting by concern if it continues to expand.
