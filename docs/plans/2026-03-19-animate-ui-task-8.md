# Task 8: Shared Components Polish

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Add animations to the 2 shared overlay components — context menu and command palette
**Parent feature:** [Animate UI Integration Index](./2026-03-19-animate-ui-integration-index.md)

## Write Set

- Modify: `src/components/shared/ContextMenu.tsx` (~230 → ~270 lines — animated menu appearance, item hover)
- Modify: `src/components/shared/CommandPalette.tsx` (~461 → ~500 lines — backdrop animation, result transitions)

## Read Set (context needed)

- `src/components/shared/ContextMenu.tsx` — floating menu with 4-8 items depending on context (canvas, node, edge, refnode)
- `src/components/shared/CommandPalette.tsx` — cmdk-based palette with 6 providers (@nodes, >actions, #entities, etc.)
- `src/components/ui/dialog.tsx` — animated dialog from Task 2 (CommandPalette uses dialog-like overlay)
- `src/components/canvas/Canvas.tsx` — renders both ContextMenu and CommandPalette

## Dependencies

- **Blocked by:** Task 2 (uses animated patterns from dialog/button)
- **Blocks:** None

## Description

These two overlay components are the primary interaction points beyond direct canvas manipulation. Both appear on demand (right-click or Cmd+K) and should feel responsive and polished.

### Per-component plan

**ContextMenu** — Right-click floating menu.
- Menu appearance: scale-in from click origin point + fade (150ms). Use `transformOrigin` set to cursor position for natural feel.
- Menu items: no stagger (menu should appear fully formed for fast interaction)
- Item hover: animated background highlight with slight scale (`whileHover={{ scale: 1.02, backgroundColor: "var(--color-accent)" }}`)
- Danger items (Delete): red text + hover background in destructive color
- Menu exit: quick fade-out (100ms) on selection or dismiss
- Dividers: already present, no animation needed
- Keyboard navigation: ensure `motion` doesn't interfere with arrow key navigation

**CommandPalette** — Full-screen command palette.
- Backdrop: fade-in overlay (same as dialog pattern from Task 2)
- Dialog entrance: scale from 0.95 + fade, centered (same as dialog)
- Search input: auto-focus with subtle ring animation (glow expansion on focus)
- Results area: `AnimatePresence` with `mode="popLayout"` — when results change (as user types), old results exit and new results enter smoothly
- Result items: no per-item stagger (results change rapidly with typing, stagger would cause visual chaos)
- Empty state: fade-in for "No results found" text
- Category headers (@, >, #): subtle entrance when category appears
- Selected item highlight: animated background that follows keyboard navigation (similar to toolbar indicator from Task 4, using `motion.div` with `layoutId`)
- Exit: quick scale-down + fade (150ms)

### Key constraints

1. **cmdk compatibility** — CommandPalette uses `cmdk` (Command component from pacocoursey). Motion wrappers must not break cmdk's internal keyboard navigation, focus management, or filtering. Test thoroughly with keyboard navigation.

2. **Performance with rapid typing** — CommandPalette re-renders results on every keystroke. Animations on result items must be lightweight. Avoid `AnimatePresence` on individual result items if it causes jank. Test with 50+ results.

3. **ContextMenu positioning** — Currently uses absolute positioning based on mouse coordinates. Motion's `scale` transform-origin must match the click position, not the default center. Pass `style={{ transformOrigin: \`\${x}px \${y}px\` }}` or use CSS custom properties.

4. **Touch/mobile** — ContextMenu may need long-press trigger on touch devices (future consideration, not this task).

### Animation timing guidelines

| Animation | Duration | Notes |
|-----------|----------|-------|
| Context menu appear | 150ms | Scale from click origin |
| Context menu dismiss | 100ms | Fast fade — user already moved on |
| Palette backdrop | 150ms | Fade |
| Palette dialog enter | 200ms | Scale + fade |
| Palette dialog exit | 150ms | Faster than enter |
| Result list transition | 100ms | Fast — user is typing |
| Selected item follow | 50ms | Spring, very fast |

### Acceptance criteria

- Context menu appears with scale-from-origin animation on right-click
- Context menu items have hover highlight animation
- Command palette opens/closes with dialog-style animation
- Command palette results transition smoothly when query changes
- Keyboard navigation highlight follows selected item smoothly
- No jank when typing quickly in command palette (60fps)
- `npm run build` and `npm run typecheck` pass
- Existing E2E tests that use context menu still pass
- cmdk keyboard navigation (up/down/enter) still works perfectly
