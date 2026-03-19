# 27: Animate UI Integration

> **Date**: 2026-03-19 | **Status**: Complete
> **Scope**: Integrate `motion` animation library across all UI surfaces — primitives, layout, panels, dialogs, onboarding, and chat

## Recap

This milestone added tasteful, functional animations to every non-canvas UI surface of ArchCanvas. After the navigation animation rollback (milestone 26) removed experimental canvas-level animation code, this effort took a different approach: using the `motion` library (successor to framer-motion) with Radix primitives for chrome/UI-only animations — buttons, dialogs, tabs, lists, cards — never touching ReactFlow internals.

The work was organized as an 8-task plan with a clear dependency graph, executed across 4 phases:

- **Phase 1** (Task 1): Foundation — installed `motion` dependency, added CSS animation keyframes (`accordion-down`, `accordion-up`) to `@theme`, verified build compatibility.
- **Phase 2** (Task 2): Upgraded 5 existing shadcn/ui primitives (`dialog`, `tooltip`, `button`, `scroll-area`, `separator`) with enter/exit animations via `motion/react`. Established the core patterns: `useReducedMotion()` gating, `AnimatePresence` + `forceMount` for Radix exit animations, spring physics for interactive elements.
- **Phase 3** (Tasks 3, 4, 8 — parallel): Added 6 new animated primitives (`tabs`, `accordion`, `checkbox`, `dropdown-menu`, `popover`, `switch`), animated 5 layout components (ProjectGate, LeftToolbar with `layoutId` sliding indicator, StatusBar with `AnimatePresence` modified badge, RightPanel content transitions, Breadcrumb fade), and polished 2 shared components (ContextMenu scale entrance, CommandPalette backdrop animation).
- **Phase 4** (Tasks 5, 6, 7 — parallel): Animated all remaining application components — onboarding wizard (directional step transitions, card hover lift, tech stack → Checkbox), dialogs (AppearanceDialog `layoutId` indicators, CreateSubsystemDialog animated overlay), detail panels (Tabs primitive integration in NodeDetailPanel, AnimatePresence on notes/entities/code-refs), and chat panel (message entrance by direction, thinking dots, tool call expand, permission card state transitions, `<select>` → DropdownMenu for provider selector).

Final state: 33 files modified, ~1440 lines added / ~700 removed, producing a net +743 lines. All 1431 unit tests pass, build compiles clean. The animation layer is purely additive — no functional behavior changed, no store logic touched.

**What's next**: fix `bun` PATH for Tauri `beforeBuildCommand`, final release testing.

## Decisions

### Animation Strategy

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Animation scope | Chrome/UI only | Canvas nodes/edges | ReactFlow manages its own rendering; injecting motion into RF nodes would cause performance issues and fight the library |
| Animation library | `motion` (motion/react) | CSS-only animations | `motion` provides `AnimatePresence` for exit animations, `layoutId` for shared layout animations, and `useReducedMotion` — none of which are achievable with CSS alone |
| Exit animation approach | `forceMount` + `AnimatePresence` on Radix portals | CSS `data-[state=closed]` transitions | CSS transitions can't animate height to/from `auto` or coordinate exit timing; `forceMount` keeps the DOM node alive for motion's exit animation |
| Reduced motion | `useReducedMotion()` hook per component | Global CSS `@media (prefers-reduced-motion)` | Hook approach allows conditional `initial={prefersReduced ? false : {...}}` which completely skips motion setup, not just duration:0 |

### Test Compatibility

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| happy-dom exit animations | Entry-only animations (no `AnimatePresence` exit) in some components | Full enter+exit everywhere | happy-dom doesn't complete motion exit animations, causing `mode="wait"` to block and tests to hang. Entry-only is the pragmatic choice for components with extensive test coverage |
| ChatProviderSelector tests | Updated tests for DropdownMenu trigger API | Kept `<select>` to avoid test changes | The `<select>` → DropdownMenu upgrade was a clear UX win; 3 tests updated with new assertions |

## Retrospective

- **What went well** — The 4-phase dependency graph with parallel execution worked exactly as designed. Tasks 5, 6, 7 ran as parallel agents with zero conflicts (no shared write files). The primitive-first approach (Tasks 1-3 before consumers) meant every consumer could import fully-animated primitives without worrying about the animation layer.

- **What went well** — The `useReducedMotion()` pattern established in Task 2 propagated cleanly to all 17 consumer files. Every animation in the app respects the user's accessibility preferences.

- **Lessons** — happy-dom/jsdom don't complete `motion` exit animations. Components with heavy test coverage need entry-only animations or `AnimatePresence` without `mode="wait"`. This is a known limitation that should inform future animation work: test first, then decide if exit animations are worth the test complexity.

- **Lessons** — `layoutId` (used for toolbar indicator, mode buttons, text-size buttons) is the highest-impact animation per line of code. One `motion.div` with a `layoutId` prop creates a smooth sliding indicator that would take 50+ lines of manual animation code. Worth reaching for whenever there's a group of buttons with an active state.

- **Notes for future** — The `ChatProviderSelector` is now a `DropdownMenu` which is more capable than the old `<select>` (custom styling, availability dots, icons). If additional provider metadata is added later (model name, token limits), the DropdownMenu can display it without constraints.
