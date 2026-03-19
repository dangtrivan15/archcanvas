# Task 6: Detail Panels & Entity Views

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Add animations to the 6 right-panel detail components — node/edge panels, property/notes/code tabs, entity panel
**Parent feature:** [Animate UI Integration Index](./2026-03-19-animate-ui-integration-index.md)

## Write Set

- Modify: `src/components/panels/NodeDetailPanel.tsx` (~97 → ~130 lines — animated tab switching)
- Modify: `src/components/panels/EdgeDetailPanel.tsx` (~154 → ~180 lines — section animations)
- Modify: `src/components/panels/PropertiesTab.tsx` (~129 → ~160 lines — form field animations, animated checkbox)
- Modify: `src/components/panels/NotesTab.tsx` (~216 → ~250 lines — note list animations, form transition)
- Modify: `src/components/panels/CodeRefsTab.tsx` (~121 → ~145 lines — list item animations, copy feedback)
- Modify: `src/components/panels/EntityPanel.tsx` (~139 → ~175 lines — accordion expand/collapse)

## Read Set (context needed)

- `src/components/panels/NodeDetailPanel.tsx` — header with editable name, 3-tab interface (Properties/Notes/Code)
- `src/components/panels/EdgeDetailPanel.tsx` — from/to nodes, label, protocol selector, entities list, notes
- `src/components/panels/PropertiesTab.tsx` — dynamic form from NodeDef args (text, number, checkbox, select, object)
- `src/components/panels/NotesTab.tsx` — note list with author/content/tags/createdAt, add/edit form
- `src/components/panels/CodeRefsTab.tsx` — code reference list with file paths, copy/delete buttons
- `src/components/panels/EntityPanel.tsx` — expandable entity list with descriptions, code refs, usage counts
- `src/components/ui/tabs.tsx` — animated Tabs from Task 3
- `src/components/ui/accordion.tsx` — animated Accordion from Task 3
- `src/components/ui/checkbox.tsx` — animated Checkbox from Task 3

## Dependencies

- **Blocked by:** Task 3 (needs Tabs, Accordion, Checkbox primitives)
- **Blocks:** None

## Description

This task adds animation to the detail panel components that appear when users select nodes, edges, or view entities. These panels are used frequently during editing, so animations must be **fast and non-blocking** — they should enhance the feel without slowing interaction.

### Per-component plan

**NodeDetailPanel** — The most frequently used panel.
- Replace current manual tab implementation with animated Tabs from Task 3
- Tab content transitions: cross-fade with `AnimatePresence mode="wait"` (150ms)
- Editable name field: subtle highlight animation when entering edit mode
- Type/NodeDef display: consider a badge-style with hover popover (future, not this task)

**EdgeDetailPanel** — Similar structure to node panel.
- From/To node display: entrance fade-in when edge is selected
- Protocol selector: animated selection indicator (same sliding pattern)
- Entity pills: `AnimatePresence` for add/remove transitions — new pills scale-in, removed pills scale-out
- Notes section: same patterns as NotesTab

**PropertiesTab** — Dynamic form rendering.
- Field entrance: staggered fade-in when tab becomes active (each field group 30ms stagger)
- Checkbox args: replace with animated Checkbox from Task 3
- Select inputs: consider upgrading to animated dropdown (if simple enough, otherwise defer)
- Required field indicator: subtle pulse on the asterisk if validation fails
- Object/nested fields: collapsible with Accordion animation

**NotesTab** — List + form pattern.
- Note list items: `AnimatePresence` with stagger — notes fade-in on load, new notes slide-in from top
- Add note form: `AnimatePresence` slide-down when toggling add mode
- Edit mode: inline expand animation for the edit form
- Delete animation: note slides out and remaining notes collapse smoothly (layout animation)
- Tags: pill-style with subtle entrance animation

**CodeRefsTab** — Simple list.
- List items: stagger fade-in
- Copy feedback: animated transition from copy icon → checkmark (already partially implemented with "✓ Copied" text, upgrade to icon swap with cross-fade)
- Delete: item fades out, list collapses with layout animation
- Add input: slide-down entrance

**EntityPanel** — Expandable list.
- Replace current expand/collapse with animated Accordion from Task 3
- Each entity section: smooth height animation on expand/collapse
- Usage count badge: number animation if count changes (optional)
- Description text: fade-in on expand
- Nested code refs: same patterns as CodeRefsTab

### Animation timing guidelines

| Animation | Duration | Notes |
|-----------|----------|-------|
| Tab switch | 150ms | Cross-fade, must feel instant |
| List item stagger | 30ms per item, max 200ms total | Cap stagger to prevent slow lists |
| Add/remove item | 150ms | Scale + fade |
| Expand/collapse | 200ms | Height animation via Accordion |
| Form appearance | 150ms | Slide-down |

### Acceptance criteria

- NodeDetailPanel tabs animate on switch
- PropertiesTab uses animated Checkbox for boolean fields
- NotesTab list items animate on add/remove
- CodeRefsTab copy icon animates on click
- EntityPanel sections expand/collapse smoothly via Accordion
- Animations feel fast (< 200ms for interactions, < 300ms for layout)
- `npm run build` and `npm run typecheck` pass
- Existing unit tests for panel components still pass
