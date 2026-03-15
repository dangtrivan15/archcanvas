# 13: Refactor, Cleanup & Test Hardening

> **Date**: 2026-03-15 | **Status**: Complete
> **Scope**: Eliminate accumulated tech debt, DRY up duplicated code, fix remaining bugs, and add missing test coverage before I6b (Onboarding Wizard)

## Recap

After completing 12 initiatives (I1 through Interrupt & SDK Types), the codebase had accumulated 43 tracked items across progress docs — known gaps, deferred renames, duplicated logic, missing tests. Before starting I6b (Onboarding Wizard), we paused to audit every gap, validate each against the current code state, and address everything that fell under refactor/cleanup/tests.

The audit found that 5 of the 12 tracked gaps were already resolved (array index keys, Tauri plugin-fs workaround, TauriFilePicker graceful fallback, BetaRawMessageStreamEvent cast, tool_progress handler). The remaining 7 genuine gaps plus 3 test coverage holes became 7 tasks across 3 execution groups.

The biggest structural change was extracting the addNode validation logic — identical code in `src/cli/commands/add-node.ts` and `src/core/ai/webSocketProvider.ts` — into a shared pure function in `src/core/validation/addNodeValidation.ts`. This enforces a `NodeDefLookup` interface that decouples validation from Zustand, making it testable without store mocks.

The chatStore cleanup introduced `InteractiveChatProvider` as a sub-interface of `ChatProvider`, replacing 4 duck-typed `as any` casts with a single `isInteractiveProvider()` type guard. The rate-limit warning was separated from the error field into its own `warning: string | null` state, rendered as an amber banner (vs red for errors), and auto-cleared on `done`, new message, and `clearHistory`.

The `CanvasFile` → `Canvas` rename — deferred since I4 and mentioned in 5 progress docs — was completed via IDE refactoring with manual cleanup for stragglers. The function names `parseCanvasFile`/`serializeCanvasFile` were also renamed to `parseCanvas`/`serializeCanvas` for consistency, touching 60+ occurrences across 21 files.

Test count rose from 976 to 1003 (+27 unit/integration tests) plus 6 new Playwright E2E tests. The `bridge.test.ts` file (1227 lines) was split into 4 focused files with a shared helpers module. The project is now clean for I6b.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| How to DRY addNode validation | Pure function with `NodeDefLookup` interface | Shared module importing registryStore directly | Keeps validation testable without Zustand mocks; callers inject the registry at call site |
| How to eliminate chatStore duck-typing | `InteractiveChatProvider` sub-interface + `isInteractiveProvider()` type guard | `callProviderMethod` generic helper | Sub-interface is standard TypeScript; the type guard is a one-liner and gives full narrowing in each method body |
| Where to put rate-limit info | Separate `warning` field (amber banner) | Continue using `error` field | The `error` banner persisted after successful completion following a rate limit; a separate field with auto-clear on `done` fixes the UX |
| How to fix U4 menu-deselect | Ref-based guard on `onPaneClick` | State-based check in `useCallback` | Refs avoid stale-closure issues — the ref always reflects current state regardless of React's batching behavior |
| Rename `parseCanvasFile`/`serializeCanvasFile` too? | Yes, rename to `parseCanvas`/`serializeCanvas` | Keep function names, only rename the type | User preference for full consistency; the "File" suffix was describing the operation but `parseCanvas` reads just as clearly |
| How to split bridge.test.ts | 4 files by concern + shared helpers module | 2 files (tests vs helpers) | Concern-based split (session, stream, permissions) makes each file self-contained and focused |
| How to inject save failures for testing | `failOnWrite(path)` on InMemoryFileSystem | Inline FailingFileSystem in test file | Adding to InMemoryFileSystem keeps test infrastructure centralized; the method is clearly test-only |

## Retrospective

- **What went well** — The gap audit at the start was high-value. Validating 43 items against the actual code state eliminated 5 false gaps and focused effort on the 7 real ones. The subagent-driven development approach (fresh agent per task + spec review) produced clean, focused implementations — each task was self-contained with no cross-contamination. The IDE-assisted rename for Task 5 was dramatically faster than doing it through code agents, though it required 3 passes to catch all stragglers (type references, function names, test file imports).

- **What didn't** — The `replace_all` Edit tool doesn't support word-boundary matching, so `CanvasFile` inside `serializeCanvasFile` got replaced to `serializeCanvas` unintentionally during manual fixup. This required a revert-and-redo cycle. Also, CLI integration tests (`test/cli/`) failed spuriously when a preview server was still running on port 4173 — the CLI detected it as a bridge URL and routed requests there instead of running locally.

- **Lessons** — When doing bulk renames via `replace_all`, always check for the target string appearing as a substring of longer identifiers. The port-conflict issue with CLI tests suggests we need to either randomize test ports or explicitly disable bridge detection in CLI test environments. IDE rename is the right tool for mechanical renames — it understands scope, imports, and type references in ways that text replacement cannot.

- **Notes for future** — The pre-existing `permissionStore.d.ts` stale output file causes `tsc --noEmit` to fail (TS6305). This is unrelated to any Phase 13 work and should be cleaned up. The 4 failing E2E panel-toggle tests (`ai-chat.spec.ts:219/251`, `canvas-operations.spec.ts:272/304`) are also pre-existing and unrelated to this phase.
