# 08: AI Integration (I6a)

> **Date**: 2026-03-13 | **Status**: Complete
> **Scope**: AI-powered architecture editing via Claude Code chat, with reactive canvas updates through HTTP mutation API

## Recap

I6a delivers the AI integration layer for ArchCanvas — a chat panel in the browser that connects to Claude Code via a WebSocket bridge running in the Vite dev server. The AI can read the architecture (via CLI `--json` commands) and mutate it (via an HTTP bridge API that relays actions to the browser's Zustand stores), with changes appearing reactively on the canvas.

The implementation was decomposed into 7 tasks and executed using subagent-driven development with git worktree isolation. Each task went through a two-stage review cycle (spec compliance → code quality) before merging to main. Tasks 2+3 and Tasks 4+6 were parallelized in separate worktrees since they had no interdependencies.

**What was built (7 tasks, 37 files changed, ~7,180 lines added):**

- **T1 — Foundation types** (`src/core/ai/types.ts`, `systemPrompt.ts`, `test/mocks/mockClaudeCode.ts`): ChatEvent discriminated union (7 variants), ClientMessage types, ProjectContext, ChatProvider interface, system prompt builder, 7 mock scenarios for testing.
- **T2 — Claude Code bridge & Vite plugin** (`src/core/ai/claudeCodeBridge.ts`, `vitePlugin.ts`): BridgeSession wrapping `@anthropic-ai/claude-agent-sdk`, WebSocket endpoint at `/__archcanvas_ai`, 5 HTTP mutation endpoints with correlation IDs and 10s timeout, permission handling via `canUseTool` callback.
- **T3 — WebSocket provider & chatStore** (`src/core/ai/webSocketProvider.ts`, `src/store/chatStore.ts`): Browser-side WebSocket client with exponential backoff reconnection, explicit switch-based store action dispatch, chat store with streaming state management.
- **T4 — Chat panel UI** (5 React components): ChatPanel, ChatMessage, ChatToolCall, ChatPermissionCard, ChatProviderSelector — all rendering from chatStore state.
- **T5 — UI integration**: `uiStore.rightPanelMode` (reactive Zustand state), toolbar button with `data-active` attribute, `Cmd+Shift+I` keyboard shortcut, `archcanvas:toggle-chat` custom event.
- **T6 — CLI bridge detection**: `detectBridge()` health probe, `bridgeMutate()` HTTP client with 30s timeout and JSON parse guard, 5 mutation commands updated with bridge-first fallback.
- **T7 — E2E tests**: 17 Playwright tests covering toggle, layout, node selection interaction, panel collapse, and button visual state.

**Test count**: 809 unit/integration tests + 17 E2E tests (up from 616 total before I6a). The sole failure is a pre-existing CLI round-trip timeout unrelated to I6a.

**Spec**: `docs/specs/2026-03-13-i6a-ai-integration-design.md`
**Plan**: `docs/plans/2026-03-13-i6a-ai-integration-index.md` (7 task files)

## Decisions

### Architecture

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Store action dispatch in WebSocket provider | Explicit switch-based named params | `Object.values(args)` with dynamic dispatch | Insertion-order dependence on `Object.values` makes it fragile; named params are explicit and debuggable |
| `rightPanelMode` as Zustand state | Reactive `set()` state | Module-level ref (existing uiStore pattern) | RightPanel needs to re-render when mode changes; module refs don't trigger subscriptions |
| ChatProvider streaming interface | `AsyncIterable<ChatEvent>` | Callback/EventEmitter | Natural fit for `for await...of` consumption, composable with abort signals |
| Permission handling | Duck-typing (`'sendPermissionResponse' in provider`) | Interface type guard | Avoids tight coupling between chatStore and specific provider implementations |
| E2E button state assertions | `data-active` attribute | Tailwind class name matching | CSS classes are build-time artifacts; semantic attributes are a stable test contract |

### SDK & Dependencies

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| SDK package | `@anthropic-ai/claude-agent-sdk` | `@anthropic-ai/claude-code` (spec) | Agent SDK is the correct package for programmatic Claude Code integration; both installed for compatibility |
| Bridge health timeout | 2s for detection, 30s for mutations | Single timeout | Detection should be fast (non-blocking startup); mutations can legitimately take time |

## Retrospective

- **What went well** — Subagent-driven development with worktree isolation worked excellently. Parallelizing independent tasks (T2+T3, T4+T6) roughly halved wall-clock time for those phases. The two-stage review cycle caught real issues: spec reviewers found field name divergences in T1, code quality reviewers found fragile dispatch patterns in T3, stuck streaming state in chatStore, and missing timeout guards in T6.

- **What didn't** — Worktrees branched from the commit at dispatch time, not from current main. This meant later tasks (T5, T7) didn't have earlier task code available, forcing stub creation (ChatPanel stub in T5, missing `data-active` for active prop in T7). Merge resolution was straightforward but required manual attention each time. The T1 implementer agent diverged significantly from spec field names (13+ mismatches) — the spec reviewer initially missed most of them, requiring a manual comparison pass.

- **Lessons** — (1) For subagent-driven worktree development, consider rebasing worktrees onto current main before dispatch if the task depends on recently-merged code. (2) Spec reviews should systematically compare every type field and interface member against the spec, not just behavioral requirements. (3) The `data-active` attribute pattern is cleaner than class-name assertions for E2E tests — worth adopting as a convention.

- **Notes for future** — The WebSocket provider registers no providers in `vite preview` mode (only in `vite dev`), so E2E tests show "No providers" instead of "Claude Code". Live AI conversation testing requires integration tests (covered in T2/T3), not E2E. The pre-existing CLI round-trip timeout test (`cli-integration.test.ts:603`) should be investigated separately — it's a 5s timeout on a multi-step `execFile` chain.
