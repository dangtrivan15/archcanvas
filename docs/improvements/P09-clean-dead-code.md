# P09: Clean Dead Code and Proto Compatibility

**Status**: COMPLETED (2026-03-09, commit `c05ebec`)

**Parallel safety**: FULLY INDEPENDENT. Quick cleanup task. Touches specific
dead code sections that no other proposal modifies.

---

## Summary of Changes

### What Was Done

1. **Removed `aiSender` parameter** from `pipeline.ts` (`AnalyzeOptions`) and
   `browserPipeline.ts` (`BrowserAnalyzeOptions`) — the parameter was always
   `undefined` in every caller. Removed the dead `if (aiSender)` branches and
   AI inference code paths, leaving only structural fallback.

2. **Removed `apiKey` / `_apiKey` dead variables** from `analyze.ts` —
   always `undefined` since SDK removal. Removed the parameter from
   `runLegacyPipeline` and `handleMergeMode` function signatures.

3. **Removed `runBuiltInAI` stub** from `projectStore.ts` — both the interface
   field and the implementation (which just showed an error toast). No UI
   component called it.

4. **Cleaned all ghost comments** referencing "AI store removed" or
   "Anthropic SDK removed" across `coreStore.ts`, `projectStore.ts`,
   `analyze.ts`, and `vite-env.d.ts`.

5. **Updated tests** — removed mock AI sender helpers and AI-specific test
   cases from `pipeline.test.ts`. Updated `analysisPipelineIntegration.test.ts`
   to verify `aiSender` is no longer passed.

### What Was NOT Done (and Why)

- **`bridgeConnection.ts` was NOT deleted** — the original spec claimed it was
  unused, but audit found it is actively imported by `terminalStore.ts`
  (16 references) and `TerminalPanel.tsx`. It is live code.

- **`inferEngine.ts` was NOT deleted** — marked `@deprecated` but its types
  (`InferenceResult`, `InferredNode`, `InferredEdge`, `InferredCodeRef`) and
  utilities (`extractJson`, `batchFiles`, `mergeResults`) are imported by
  5 files (`merge.ts`, `pipeline.ts`, `browserPipeline.ts`, `graphBuilder.ts`,
  `prompts/types.ts`). Deleting it would break the build.

- **`fileIO.ts` AI state encode/decode was preserved** — needed for proto
  round-trip compatibility. The code correctly decodes `aiState` from .archc
  files and re-encodes it on save, ensuring no data loss.

---

## Files Modified

| File | Change |
|------|--------|
| `src/analyze/pipeline.ts` | Removed `aiSender` from interface and destructure, replaced AI inference block with structural-only |
| `src/analyze/browserPipeline.ts` | Same treatment as pipeline.ts |
| `src/cli/commands/analyze.ts` | Removed `apiKey`, `_apiKey` param, `aiSender` variables, ghost comment blocks |
| `src/store/coreStore.ts` | Removed 2 "AI store removed" comment blocks |
| `src/store/projectStore.ts` | Removed `runBuiltInAI` stub, `aiSender` variable, ghost comments |
| `src/vite-env.d.ts` | Removed "VITE_ANTHROPIC_API_KEY removed" comment |
| `test/unit/analyze/pipeline.test.ts` | Removed mock AI sender, AI-specific tests, simplified to structural-only |
| `test/unit/ui/analysisPipelineIntegration.test.ts` | Updated aiSender test to verify parameter is absent |

## Impact

- **Net diff**: +33 / -311 lines
- **No new test failures** (8 pre-existing failures unrelated to changes)
- **No new type errors** in modified files
- **No behavior changes** — structural analysis was already the only code path

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| No "AI store has been removed" comments remain | PASS |
| `bridgeConnection.ts` assessed | PASS (kept — not dead code) |
| Existing `.archc` files still open and save correctly | PASS (fileIO unchanged) |
| No behavior changes — purely a cleanup | PASS |
| `npm run test` passes (no regressions) | PASS |
| `npm run build` succeeds (no regressions) | PASS |
