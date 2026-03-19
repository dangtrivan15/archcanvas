# Task 3: Add New UI Primitives

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Add 6 new animated UI primitives from Animate UI that consumers in Tasks 5–7 will need
**Parent feature:** [Animate UI Integration Index](./2026-03-19-animate-ui-integration-index.md)

## Write Set

- Create: `src/components/ui/accordion.tsx` (~80 lines)
- Create: `src/components/ui/tabs.tsx` (~90 lines)
- Create: `src/components/ui/dropdown-menu.tsx` (~120 lines)
- Create: `src/components/ui/popover.tsx` (~70 lines)
- Create: `src/components/ui/checkbox.tsx` (~50 lines)
- Create: `src/components/ui/switch.tsx` (~50 lines)

## Read Set (context needed)

- `src/components/ui/dialog.tsx` — reference for Radix wrapper + animation patterns established in Task 2
- `src/components/ui/button.tsx` — reference for CVA + motion patterns
- `src/components/ui/menubar.tsx` — existing Radix menu (276 lines) — study its pattern since dropdown-menu is similar
- `src/index.css` — confirm animation keyframes from Task 1 (accordion-up/down)
- `src/lib/utils.ts` — `cn()` utility
- https://animate-ui.com/docs — Animate UI Radix component source for each

## Dependencies

- **Blocked by:** Task 2 (follows same patterns, writes to same directory)
- **Blocks:** Tasks 5, 6, 7 (these consumers need accordion, tabs, dropdown-menu)

## Description

This task adds 6 new animated primitives that don't exist in the project yet. Each will be used by specific downstream consumers:

| Primitive | Downstream Consumer | Purpose |
|-----------|-------------------|---------|
| **Accordion** | EntityPanel (Task 6), ChatToolCall (Task 7) | Expandable sections with smooth height animation |
| **Tabs** | NodeDetailPanel (Task 6) | Animated tab switching (Properties/Notes/Code) |
| **Dropdown Menu** | ChatProviderSelector (Task 7), ContextMenu (Task 8) | Animated dropdown replacing plain `<select>` |
| **Popover** | Various (future use) | Animated floating content |
| **Checkbox** | AiSurveyStep (Task 5), PropertiesTab (Task 6) | Animated check/uncheck |
| **Switch** | AppearanceDialog (Task 5, future enhancement) | Animated toggle |

### Approach

All 6 follow the same pattern established in Task 2:
1. Radix headless primitive as the base (matching Animate UI's "Radix UI" category)
2. `motion` for enter/exit/interaction animations
3. Tailwind 4 classes for styling (using existing CSS variables)
4. `cn()` for class merging
5. Proper TypeScript types with component display names

### Key design decisions

**Accordion** — Uses `@theme` keyframes `accordion-down` and `accordion-up` added in Task 1. Content height animates via `motion.div` with `AnimatePresence`. Trigger includes animated chevron rotation.

**Tabs** — Content area uses `AnimatePresence` with `mode="wait"` for cross-fade between tab panels. Tab indicator uses `motion.div` with `layoutId` for the sliding underline effect.

**Dropdown Menu** — Wraps `@radix-ui/react-dropdown-menu`. Animated with scale + fade on open/close. Items have hover highlight animation. This is similar to the existing `menubar.tsx` pattern but standalone.

**Popover** — Wraps `@radix-ui/react-popover`. Fade + scale with `AnimatePresence`. Arrow support.

**Checkbox** — Wraps `@radix-ui/react-checkbox`. Animated checkmark with `motion.svg` path drawing. Uses `--color-primary` for checked state.

**Switch** — Wraps `@radix-ui/react-switch`. Thumb slides with spring animation via `motion.span`. Uses `--color-primary` for active state.

### Note on Radix dependencies

The project already has `radix-ui` (^1.4.3) and `@radix-ui/react-dialog` (^1.1.15). Verify whether `radix-ui` is the new unified package that includes all primitives, or if individual packages are needed. If `radix-ui` is the unified package, no new Radix deps needed.

### Acceptance criteria

- All 6 new files exist in `src/components/ui/`
- Each component renders correctly in isolation (verify via Storybook or a quick test page)
- `npm run build` passes
- `npm run typecheck` passes
- Accordion smoothly expands/collapses
- Tabs animate content switching
- Dropdown menu opens/closes with animation
- Checkbox draws checkmark on check
- Switch thumb slides smoothly
- All components respect `prefers-reduced-motion`
