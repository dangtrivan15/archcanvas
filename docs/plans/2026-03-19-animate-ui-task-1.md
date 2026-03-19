# Task 1: Foundation & Dependencies

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Foundation setup — install animation library, configure CSS, verify build
**Parent feature:** [Animate UI Integration Index](./2026-03-19-animate-ui-integration-index.md)

## Write Set

- Modify: `package.json` (~5 lines — add `motion` dependency)
- Modify: `src/index.css` (~30 lines — add animation keyframes in `@theme`, import `tw-animate-css` if needed)
- Modify: `components.json` (~5 lines — verify/update for Animate UI compatibility)

## Read Set (context needed)

- `src/index.css` — current theme tokens and font imports
- `components.json` — current shadcn configuration
- `package.json` — current dependencies
- `src/lib/utils.ts` — verify `cn()` utility exists (it does: `twMerge(clsx(inputs))`)
- `tsconfig.json` — verify `@/*` path alias (confirmed: `"@/*": ["./src/*"]`)

## Dependencies

- **Blocked by:** None (first task)
- **Blocks:** Task 2 (primitives need `motion` installed)

## Description

This task sets up the foundation for Animate UI integration without changing any components.

### What to do

1. **Install `motion`** — The animation engine used by Animate UI. This is the modern successor to framer-motion, with GPU-accelerated animations and a simpler API. Install as a production dependency (`motion >= 12.23.0`).

2. **Evaluate `tw-animate-css`** — Animate UI docs suggest this as a replacement for `tailwindcss-animate` on Tailwind v4. Check if it's needed by looking at the Animate UI components we plan to use. If components define their own keyframes inline via Motion, we may not need it. If needed, install and import in `src/index.css`.

3. **Add animation keyframes to `@theme`** — Some Animate UI components expect shared animation keyframes (e.g., `accordion-down`, `accordion-up`, `collapsible-down`, `collapsible-up`). Add these to the existing `@theme` block in `src/index.css`. Do NOT duplicate existing tokens — add a clearly commented section below the current tokens.

4. **Verify `components.json`** — Confirm that the current shadcn config (`style: "new-york"`, `rsc: false`, `tsx: true`, aliases) is compatible with Animate UI's expectations. The `tailwind.config` field is empty (correct for TW4). No changes expected here unless Animate UI requires a `registries` field for its component source.

5. **Verify build** — Run `npm run build` to confirm no regressions. Run `npm run typecheck` to confirm TypeScript is happy.

### Acceptance criteria

- `motion` is in `dependencies` in `package.json`
- `import { motion, AnimatePresence } from "motion/react"` works in any `.tsx` file
- `npm run build` passes
- `npm run typecheck` passes
- No existing tests break (`npm run test:unit`)
- The app runs normally with `npm run dev` — no visual changes yet
