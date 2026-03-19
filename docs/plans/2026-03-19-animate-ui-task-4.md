# Task 4: Layout & Navigation Polish

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Add animations to the 5 layout shell components — project gate, toolbar, status bar, right panel, breadcrumb
**Parent feature:** [Animate UI Integration Index](./2026-03-19-animate-ui-integration-index.md)

## Write Set

- Modify: `src/components/layout/ProjectGate.tsx` (~96 → ~140 lines — animated entrance, button hover)
- Modify: `src/components/layout/LeftToolbar.tsx` (~142 → ~180 lines — active state animation, button press feedback)
- Modify: `src/components/layout/StatusBar.tsx` (~45 → ~70 lines — animated modified badge, count transitions)
- Modify: `src/components/layout/RightPanel.tsx` (~121 → ~155 lines — panel content transition)
- Modify: `src/components/shared/Breadcrumb.tsx` (~26 → ~45 lines — navigation fade transition)

## Read Set (context needed)

- `src/components/layout/ProjectGate.tsx` — renders logo, heading, Open/New buttons, error banner
- `src/components/layout/LeftToolbar.tsx` — 10 icon tool buttons with tooltips, active state via `bg-accent`
- `src/components/layout/StatusBar.tsx` — version, filename, Modified badge, scope, node/edge counts
- `src/components/layout/RightPanel.tsx` — conditional rendering: detail panel, chat, entity panel, empty state
- `src/components/shared/Breadcrumb.tsx` — navigation path with clickable ancestors
- `src/components/ui/button.tsx` — animated button from Task 2
- `src/components/ui/tooltip.tsx` — animated tooltip from Task 2
- `src/store/toolStore.ts` — tool active state (select/pan/connect)
- `src/store/fileStore.ts` — isDirty, project status
- `src/store/navigationStore.ts` — breadcrumb data

## Dependencies

- **Blocked by:** Task 2 (uses animated Button and Tooltip)
- **Blocks:** None

## Description

This task applies `motion` animations to the 5 layout components that form the app's shell. These are visible on every screen, so animations should be **subtle and fast** — no bouncing or attention-grabbing effects.

### Per-component plan

**ProjectGate** — The first screen users see when no project is loaded.
- Logo + heading: staggered fade-in on mount (`motion.div` with `initial`/`animate` and `transition.delay`)
- Action buttons: slight scale-up hover effect (already from Task 2's button, but may add extra entrance stagger)
- Error banner: slide-down from top with `AnimatePresence` (conditional rendering)
- Loading text: gentle pulse or fade animation

**LeftToolbar** — Always visible vertical toolbar.
- Active tool indicator: animated background highlight that slides between buttons using `motion.div` with `layoutId` (similar to a pill indicator). This replaces the current static `bg-accent` class toggle.
- Tool buttons: already get press feedback from Task 2's animated Button
- Divider between tool groups: subtle appear animation on mount

**StatusBar** — Bottom bar with metadata.
- "Modified" badge: animate in/out with `AnimatePresence` (scale + fade) when `isDirty` toggles
- Node/edge counts: use `motion` number morphing or a simple fade when counts change (optional — only if it doesn't add complexity)
- Keep status bar minimal — it should not distract

**RightPanel** — Content area that switches between detail/chat/entity modes.
- Content transition: wrap the conditional render in `AnimatePresence` with `mode="wait"`. Exiting content fades out, entering content fades in.
- Collapse/expand: if the panel collapses (chevron button), animate width transition
- Empty state: gentle fade-in for the "Select a node" prompt

**Breadcrumb** — Navigation path overlay on the canvas.
- When navigating into/out of subsystems, the breadcrumb segments should animate: new segment slides in from right, removed segment slides out to right
- Use `AnimatePresence` with `key` on each segment for enter/exit

### Animation timing guidelines

| Animation | Duration | Easing |
|-----------|----------|--------|
| Fade in/out | 150–200ms | ease-out |
| Slide in/out | 200–250ms | ease-out |
| Scale (hover) | 100ms | ease-out |
| Layout shift (toolbar indicator) | 200ms | spring (stiffness: 500, damping: 30) |

### Acceptance criteria

- ProjectGate has visible entrance animation when app loads
- LeftToolbar active indicator animates smoothly between tools
- StatusBar "Modified" badge animates in/out
- RightPanel content transitions between modes (detail ↔ chat ↔ entity)
- Breadcrumb segments animate on navigation
- All animations disabled under `prefers-reduced-motion`
- `npm run build` and `npm run typecheck` pass
- No visual regressions in existing layout
