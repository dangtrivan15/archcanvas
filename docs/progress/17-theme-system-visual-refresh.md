# 17: Theme System & Visual Refresh

> **Date**: 2026-03-17 | **Status**: Complete
> **Scope**: Configurable color palettes (ArchCanvas Default, Rosé Pine, Catppuccin) with light/dark/system modes, text size presets, Appearance settings dialog, font upgrade, CSS variable migration, visual polish

## Recap

ArchCanvas had a single hardcoded dark theme, system fonts, and no user preference controls. This milestone added a complete theme system: 3 color palettes each with light and dark modes, a system-mode listener that follows OS preference, text size presets (S/M/L), and an Appearance dialog accessible from the View menu, Command Palette, and a toolbar quick-toggle.

The architecture uses CSS custom properties as the bridge between Tailwind 4 and runtime theming. A `themeStore` (Zustand + localStorage) drives `applyTheme()` which sets `--color-*` on `<html>`. Tailwind's `@theme` block retains ArchCanvas Default dark values as compile-time defaults, ensuring utility classes work at build time and providing a CSS-only fallback if JS fails. At runtime, inline styles on `<html>` override `@theme` due to higher specificity — so `bg-background`, `text-foreground`, etc. "just work" across all palettes without any Tailwind config changes.

The theme token system has 30 semantic tokens (19 UI + 11 canvas-specific), all defined in `ThemeTokens` interface. Every hardcoded hex color in `nodeShapes.css` and `EdgeRenderer.css` was migrated to CSS variables (warning/unknown-type colors intentionally remain hardcoded as semantic indicators). Self-hosted Inter and Monaspace Argon fonts replace system fonts, with `font-mono` applied to code-facing UI elements. Resize handles were polished from a grip icon to an invisible hover-line.

Flash prevention uses a Vite plugin (`viteFlashPlugin.ts`) that reads palette data from the TS source files at build time and injects a synchronous `<script>` into `index.html` via `transformIndexHtml`. This eliminates duplication — palette values live in one place (the TS palette files) and the inline script is generated automatically. The plugin replaces a `<!--THEME_FLASH_PREVENTION-->` placeholder in `index.html`.

**Spec**: `docs/specs/2026-03-17-theme-system-and-visual-refresh-design.md`
**Plan**: `docs/plans/2026-03-17-theme-system-visual-refresh.md`

### By the numbers

- 17 commits, 36 files changed, +1217 / -88 lines
- 1370 unit tests (up from 985), 70 E2E tests (6 new theme tests)
- 9 new files, ~12 modified files
- 5 woff2 font files (~610KB total)

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Flash prevention data source | Vite plugin generating from TS sources | Hardcoded JSON in index.html | Single source of truth — palette values aren't duplicated. Initially shipped with duplication, then refactored to plugin approach |
| Build type-checking | `tsc --noEmit` (single tsconfig) | `tsc -b` with composite project references | `tsconfig.node.json` required an explicit include list that kept falling out of sync as the import graph grew. `tsc --noEmit` uses the main tsconfig which covers all of `src/` |
| Theme default mode | `system` (follows OS preference) | `dark` (matching previous hardcoded theme) | Better UX — respects user's OS setting out of the box. Required updating existing E2E tests that assumed dark-only backgrounds |
| Warning/unknown-type colors | Hardcoded (not themed) | CSS variables | These are semantic indicators (amber/warning) that should stay consistent across all palettes, similar to how `destructive` conveys a fixed meaning |
| Canvas text sizing | Hardcoded px (not affected by text size preset) | rem-based (would scale with preset) | Canvas content has its own zoom via ReactFlow — text size preset controls only UI chrome |
| Resize handle style | Invisible + hover-line (opacity transition) | Grip icon (`⠿`) | Cleaner visual — the default grip icon was visually noisy. The hover-line is subtle but discoverable |

## Retrospective

- **What went well** — The TDD approach worked cleanly for the core infrastructure (Tasks 1-3). Writing palette validation tests first caught issues early. The Vite plugin for flash prevention was a clean solution that emerged from discussing the duplication concern — worth the extra iteration.

- **What didn't** — The `tsconfig.node.json` breakage was an unexpected detour. The composite project reference setup had been silently broken (or the E2E tests hadn't been run recently), and it only surfaced when we tried `npm run build` for E2E. The fix was straightforward but took discussion to find the right approach.

- **Lessons** — (1) When a config file requires maintaining an explicit list of transitive dependencies, it's a maintenance trap — prefer patterns that don't need manual upkeep. (2) E2E tests that assert specific color values ("not white") are fragile when adding theme support — assert structural properties ("not transparent") instead. (3) The `matchMedia` guard (`typeof window.matchMedia !== 'function'`) is needed for jsdom environments that import themeStore transitively.

- **Notes for future** — The 2 flaky onboarding E2E tests (`AI Analyze advances to survey step`, `back from survey returns to step 1`) still fail intermittently in parallel runs. They pass in isolation. This is a pre-existing issue unrelated to the theme work. Adding new palettes requires only creating a new TS file in `src/core/theme/palettes/` and adding it to the registry array — the Vite plugin picks it up automatically.
