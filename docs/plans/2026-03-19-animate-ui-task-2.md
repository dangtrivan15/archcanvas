# Task 2: Upgrade Existing UI Primitives

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Replace 4 existing shadcn/ui primitives with Animate UI's animated Radix variants
**Parent feature:** [Animate UI Integration Index](./2026-03-19-animate-ui-integration-index.md)

## Write Set

- Modify: `src/components/ui/dialog.tsx` (~130 → ~160 lines — add enter/exit animations)
- Modify: `src/components/ui/tooltip.tsx` (~55 → ~70 lines — add fade/scale animation)
- Modify: `src/components/ui/button.tsx` (~64 → ~90 lines — add press/hover motion variants)
- Modify: `src/components/ui/scroll-area.tsx` (~56 → ~65 lines — add smooth scrollbar fade)
- Modify: `src/components/ui/separator.tsx` (~28 → ~35 lines — add expand animation)

## Read Set (context needed)

- `src/components/ui/dialog.tsx` — current Radix dialog wrapper, used by AppearanceDialog + CreateSubsystemDialog
- `src/components/ui/tooltip.tsx` — current Radix tooltip, used by LeftToolbar
- `src/components/ui/button.tsx` — current CVA button, used everywhere
- `src/components/ui/scroll-area.tsx` — current scroll area, used in panels
- `src/components/ui/separator.tsx` — current separator
- `src/components/AppearanceDialog.tsx` — consumer of Dialog (verify API compatibility)
- `src/components/CreateSubsystemDialog.tsx` — consumer of Dialog (verify API compatibility)
- `src/components/layout/LeftToolbar.tsx` — consumer of Tooltip + Button
- `src/components/panels/ChatPanel.tsx` — consumer of ScrollArea + Button
- https://animate-ui.com/docs — Animate UI component source code for each component

## Dependencies

- **Blocked by:** Task 1 (needs `motion` installed)
- **Blocks:** Tasks 3, 4, 8 (downstream tasks import these primitives)

## Description

This task upgrades the 5 existing shadcn/ui primitives to their Animate UI equivalents. The critical constraint is **API compatibility** — every export signature must remain identical so all 37 consumer components continue working without changes.

### Approach per component

**Dialog** — The highest-impact upgrade. Currently a plain Radix dialog. Animate UI's version adds:
- Overlay: fade-in/fade-out with `motion` opacity transition
- Content: scale + fade enter/exit with `AnimatePresence`
- Keep all existing exports: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`

**Tooltip** — Add fade + slight scale animation on show/hide. Keep `Tooltip`, `TooltipTrigger`, `TooltipContent` exports unchanged. Respect `delayDuration` prop already used by LeftToolbar (300ms).

**Button** — Add subtle press animation (scale down on press, scale up on release) using `motion.button` with `whileTap` and `whileHover`. Keep all CVA variants (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) and sizes (`default`, `sm`, `lg`, `icon`). The `asChild` prop MUST continue to work (used extensively).

**ScrollArea** — Add smooth scrollbar fade transition (opacity on hover). Keep `ScrollArea`, `ScrollBar` exports.

**Separator** — Add subtle expand animation on mount. Keep `Separator` export.

### Key constraints

1. **`asChild` compatibility** — Radix's `asChild` renders children instead of the wrapper element. When `asChild` is used, motion wrappers must not interfere. Test this explicitly with Button's `asChild` usage.
2. **`forwardRef` removal** — React 19 doesn't need `forwardRef`. Animate UI's Radix components already account for this. Verify our current components' ref patterns.
3. **CVA preservation** — Button uses `class-variance-authority` for variants. Animation should be layered on top, not replace the CVA pattern.
4. **`prefers-reduced-motion`** — Wrap animations in a check or use Motion's built-in `reducedMotion` prop.

### Acceptance criteria

- All 5 components have visible enter/exit or interaction animations
- `npm run build` passes — no import errors in any consumer
- `npm run test:unit` passes — existing tests still work
- `npm run typecheck` passes
- AppearanceDialog and CreateSubsystemDialog open/close with animated transition
- LeftToolbar tooltips animate on hover
- Button press feedback is visible across the app
- `prefers-reduced-motion` disables animations gracefully
