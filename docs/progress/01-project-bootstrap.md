# 01: Project Bootstrap

> **Date**: 2026-03-11 | **Status**: Complete
> **Scope**: Archive v1, bootstrap v2 tech stack, dev/test infrastructure (Initiative I1)

## Recap

Archived the v1 codebase (protobuf-based, Capacitor iOS) to [bak](../bak) and
bootstrapped v2 from scratch. The full tech stack was installed and verified
upfront — all major dependencies at latest versions — to catch integration
issues early rather than discovering them mid-feature. Tech versions and stack
details are tracked in auto-memory.

Built a minimal app shell: resizable panel layout with ReactFlow canvas, menus,
toolbar, and detail panel. Scaffolded Tauri 2.0 for desktop (`cargo check` passes).
The shell is functional but all components are placeholders — real implementation
starts with I10.

Replaced v1's shell-script infrastructure with **convergence-point guards** —
safety mechanisms embedded in the tools themselves so they can't be bypassed:
- Dev server guard in [vite.config.ts](../../vite.config.ts) (Vite plugin, PID file)
- Test slot guard in [test/setup/slotGuard.ts](../../test/setup/slotGuard.ts)
  (globalSetup, two-layer slot system)

Cleaned up scripts to just [scripts/init.sh](../../scripts/init.sh). Deleted the
obsolete `testing` skill; `task-decomposition` skill remains valid.

**What's next**: I10 — Core Data Model & YAML. Foundation for everything else:
Zod schemas, YAML codec, file resolver, cross-scope refs. Pure TypeScript, zero
UI. After I10, I3 (NodeDef) and I4 (Graph Engine) can partially parallelize.

**V1 reuse candidates** in [bak/src](../../bak/src): `core/graph/` and
`core/layout/` have high reuse potential (pure functions). `core/registry/` and
`core/history/` are medium. Codec/fileIO is a full rewrite (protobuf → YAML).

## Decisions

### Infrastructure

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Safety enforcement | Convergence-point pattern (Vite plugin, globalSetup) | Shell script wrappers | Can't be bypassed — runs inside the tool itself |
| Lock file location | Project-local `tmp/` (gitignored) | `$TMPDIR` (OS temp) | No cross-project collisions, visible for debugging, single `rm -rf tmp/` clears all |
| Test concurrency | Two-layer slot guard (global + per-runner) | Single pool | Fine-grained control — cap total load AND tune per tool independently |
| E2E test server | `vite preview` on 4173 (production build) | Dev server on 5173 | No HMR flakiness, each worktree independent |
| Slot config | Defaults in code + env var overrides | `.test.env` file | One less config file, conventional override mechanism |
| Scripts | Keep only `init.sh` | Full scripts directory | Shell wrappers replaced by convergence-point guards |

### Tech Stack

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Vite version | 7 | 6 (design doc) | Latest stable, no issues |
| ESLint version | 9 | 10 | `eslint-plugin-react-hooks` doesn't support 10 yet |
| Test environment | jsdom (global) | happy-dom + environmentMatchGlobs | Simpler config, jsdom more battle-tested with React Testing Library |
| All-in stack | Install everything day one | Incremental additions | Avoid integration surprises later; verify compatibility upfront |

## Retrospective

- **What went well** — The convergence-point pattern was a strong design insight.
  Instead of chasing all possible entry points (npm, npx, Tauri, direct vite),
  we embedded guards at the single point where all paths converge. This pattern
  is worth repeating for future cross-cutting concerns.

- **What didn't** — Several version-related yak-shaves: ESLint 10 had to be
  rolled back, react-resizable-panels v4 removed APIs we tried to use
  (`onCollapse`/`onExpand`, `direction` → `orientation`), Tauri icon was missing.
  Each was a 10-15 minute detour. The "all-in from day one" approach catches these
  early, but it front-loads the friction.

- **Lessons** — Check library changelogs before assuming v1 APIs still exist.
  Version-specific gotchas are tracked in Claude auto-memory (`v2-details.md`)
  to avoid repeating them across sessions.

- **Notes for future** — Tauri icon is a placeholder blue PNG; replace before
  release builds. The `testing` skill needs to be rewritten once v2 test patterns
  stabilize (likely after I10 or I4).
