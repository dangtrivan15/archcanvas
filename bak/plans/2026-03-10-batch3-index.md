# Batch 3: Architecture Improvements — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Break up god components (P01), unify fractal navigation (P05), abstract storage backends (P08)
**Total tasks:** 10
**Estimated scope:** ~50 files, ~2,300 source lines across all tasks

## Dependency Graph

```
P01-T1: Dialog Registry Infrastructure         → blocks: [P01-T2, P01-T3]
P01-T2: Migrate Simple Dialogs (7)             → blockedBy: [P01-T1], blocks: [P01-T4]
P01-T3: Migrate Complex Dialogs (7)            → blockedBy: [P01-T1], blocks: [P01-T4]
P01-T4: Slim App.tsx + Extract Init Hook       → blockedBy: [P01-T2, P01-T3]

P05-T1: Unified NavigationStore                → blocks: [P05-T2]
P05-T2: Replace DOM Event + Update Hooks       → blockedBy: [P05-T1], blocks: [P05-T3]
P05-T3: Migrate Consumers + Delete Facade      → blockedBy: [P05-T2]

P08-T1: StorageBackend Types + StorageManager   → blocks: [P08-T2]
P08-T2: Split fileIO.ts + Real Backends        → blockedBy: [P08-T1], blocks: [P08-T3]
P08-T3: Wire fileStore to StorageManager       → blockedBy: [P08-T2]
```

## Execution Strategy

All three proposals touch **completely different files** and can run in parallel worktrees.

- **Parallel group 1:** P01-T1, P05-T1, P08-T1 (no dependencies between proposals)
- **Parallel group 2:** P01-T2 + P01-T3 (parallel), P05-T2, P08-T2
- **Parallel group 3:** P01-T4, P05-T3, P08-T3

Within each proposal, tasks are sequential. Across proposals, all tasks at the same
level can run in parallel.

## Tasks

| # | File | Proposal | Scope | Write Files | Source LOC | Config LOC |
|---|------|----------|-------|-------------|------------|------------|
| 1 | [P01-T1](./2026-03-10-batch3-P01-T1.md) | P01 | Dialog registry infra | 5 | ~200 | ~30 |
| 2 | [P01-T2](./2026-03-10-batch3-P01-T2.md) | P01 | Migrate 7 simple dialogs | 7 | ~150 | 0 |
| 3 | [P01-T3](./2026-03-10-batch3-P01-T3.md) | P01 | Migrate 7 complex dialogs | 8 | ~200 | 0 |
| 4 | [P01-T4](./2026-03-10-batch3-P01-T4.md) | P01 | Slim App.tsx + init hook | 3 | ~250 | 0 |
| 5 | [P05-T1](./2026-03-10-batch3-P05-T1.md) | P05 | Unified NavigationStore | 2 | ~350 | ~20 |
| 6 | [P05-T2](./2026-03-10-batch3-P05-T2.md) | P05 | Replace DOM event + hooks | 6 | ~250 | 0 |
| 7 | [P05-T3](./2026-03-10-batch3-P05-T3.md) | P05 | Migrate consumers + cleanup | 10 | ~100 | 0 |
| 8 | [P08-T1](./2026-03-10-batch3-P08-T1.md) | P08 | StorageBackend types + manager | 3 | ~250 | ~40 |
| 9 | [P08-T2](./2026-03-10-batch3-P08-T2.md) | P08 | Split fileIO + real backends | 4 | ~350 | ~10 |
| 10 | [P08-T3](./2026-03-10-batch3-P08-T3.md) | P08 | Wire fileStore | 3 | ~250 | 0 |

## Retrospective Lessons Applied

From Batch 1-2 retrospective:
- **Branch from latest main** after previous batch merged (Batch 2 is fully merged)
- **`.worktrees/` is in .gitignore** (verified)
- **Scope reduction** — cut URL deep linking, animations, Capacitor/Tauri backends, auto-sidecar
- **Run `./scripts/test.sh`** not `npm test` (mutex-locked for parallel agents)
- **Check `git status` before committing** — watch for `??` entries under `.claude/`
