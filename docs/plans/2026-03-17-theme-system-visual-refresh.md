# Theme System & Visual Refresh — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable color palettes (ArchCanvas Default, Rose Pine, Catppuccin) with light/dark/system modes, text size presets, an Appearance dialog, and visual polish (fonts, resize handles, CSS variable migration).

**Architecture:** CSS custom properties as the bridge between Tailwind 4 and runtime theming. A `themeStore` (Zustand + localStorage) drives `applyTheme()` which sets `--color-*` on `<html>`. Palettes are static TypeScript objects. A synchronous `<script>` in `<head>` prevents flash-of-wrong-theme by reading localStorage before React mounts.

**Tech Stack:** React 19, Zustand 5, Tailwind 4, Radix UI Dialog, Lucide icons, Inter + Monaspace Argon fonts (woff2, self-hosted)

**Spec:** `docs/specs/2026-03-17-theme-system-and-visual-refresh-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `src/core/theme/types.ts` | `ThemeTokens` and `ThemePalette` interfaces |
| `src/core/theme/applyTheme.ts` | Apply palette tokens as CSS custom properties on `<html>`, text size, system mode listener |
| `src/core/theme/palettes/index.ts` | Palette registry array + `findPalette()` helper |
| `src/core/theme/palettes/archcanvas.ts` | ArchCanvas Default palette (light + dark) |
| `src/core/theme/palettes/rosePine.ts` | Rose Pine palette (light + dark) |
| `src/core/theme/palettes/catppuccin.ts` | Catppuccin palette (light + dark) |
| `src/store/themeStore.ts` | Zustand store: palette/mode/textSize + localStorage persistence |
| `src/components/ui/dialog.tsx` | shadcn/ui Dialog component (Radix UI) |
| `src/components/AppearanceDialog.tsx` | Appearance settings modal |
| `test/theme/types.test.ts` | Palette validation tests |
| `test/theme/applyTheme.test.ts` | Token application tests |
| `test/store/themeStore.test.ts` | Store state transition + persistence tests |
| `public/fonts/inter/` | Inter woff2 files (400, 500, 600) |
| `public/fonts/monaspace-argon/` | Monaspace Argon woff2 files (400, 500) |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Flash prevention `<script>` in `<head>` |
| `src/index.css` | `@font-face`, canvas tokens in `@theme`, `--font-family-mono`, `--radius`, body font-family |
| `src/components/nodes/nodeShapes.css` | Hardcoded hex → CSS vars |
| `src/components/edges/EdgeRenderer.css` | Hardcoded hex → CSS vars |
| `src/components/ui/resizable.tsx` | Replace grip icon with invisible hover-line handle |
| `src/store/uiStore.ts` | Add `showAppearanceDialog` + open/close actions |
| `src/App.tsx` | Mount `AppearanceDialog`, initialize theme, `import '@/store/themeStore'` at top |
| `src/components/layout/LeftToolbar.tsx` | Theme mode toggle button |
| `src/components/layout/TopMenubar.tsx` | "Appearance..." menu item |
| `src/components/shared/CommandPalette.tsx` | "Appearance..." action |

---

## Chunk 1: Core Theme System

### Task 1: Theme Types & Palette Definitions

**Files:**
- Create: `src/core/theme/types.ts`
- Create: `src/core/theme/palettes/archcanvas.ts`
- Create: `src/core/theme/palettes/rosePine.ts`
- Create: `src/core/theme/palettes/catppuccin.ts`
- Create: `src/core/theme/palettes/index.ts`
- Test: `test/theme/types.test.ts`

- [ ] **Step 1: Write palette validation tests**

```typescript
// test/theme/types.test.ts
import { describe, it, expect } from 'vitest';
import { palettes } from '@/core/theme/palettes';
import type { ThemeTokens, ThemePalette } from '@/core/theme/types';

// Every key that ThemeTokens must have
const REQUIRED_KEYS: (keyof ThemeTokens)[] = [
  'background', 'foreground', 'card', 'cardForeground',
  'popover', 'popoverForeground', 'muted', 'mutedForeground',
  'border', 'input', 'ring',
  'primary', 'primaryForeground', 'secondary', 'secondaryForeground',
  'accent', 'accentForeground', 'destructive', 'destructiveForeground',
  'nodeBg', 'nodeBorder', 'nodeShadow',
  'nodeSelectedBorder', 'nodeSelectedRing',
  'nodeRefBg', 'nodeRefBorder',
  'edgeSync', 'edgeAsync', 'edgeDefault', 'canvasDot',
];

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

function validateTokens(tokens: ThemeTokens, label: string) {
  for (const key of REQUIRED_KEYS) {
    it(`${label} has token "${key}"`, () => {
      expect(tokens[key]).toBeDefined();
    });
    it(`${label} "${key}" is valid hex`, () => {
      expect(tokens[key]).toMatch(HEX_RE);
    });
  }
}

describe('theme palettes', () => {
  expect(palettes.length).toBeGreaterThanOrEqual(3);

  for (const palette of palettes) {
    describe(palette.name, () => {
      it('has required fields', () => {
        expect(palette.id).toBeTruthy();
        expect(palette.name).toBeTruthy();
        expect(palette.light).toBeDefined();
        expect(palette.dark).toBeDefined();
      });
      describe('light', () => validateTokens(palette.light, `${palette.name} light`));
      describe('dark', () => validateTokens(palette.dark, `${palette.name} dark`));
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/theme/types.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create types.ts**

```typescript
// src/core/theme/types.ts
export interface ThemeTokens {
  // UI tokens
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  // Canvas tokens
  nodeBg: string;
  nodeBorder: string;
  nodeShadow: string;
  nodeSelectedBorder: string;
  nodeSelectedRing: string;
  nodeRefBg: string;
  nodeRefBorder: string;
  edgeSync: string;
  edgeAsync: string;
  edgeDefault: string;
  canvasDot: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}
```

- [ ] **Step 4: Create ArchCanvas Default palette**

Create `src/core/theme/palettes/archcanvas.ts`. This palette maps the existing zinc-based dark theme values and creates a corresponding light theme.

Reference the current `@theme` block in `src/index.css` (lines 4-25) for the dark values. For the light variant, use the "C" (Light & Airy) aesthetic from brainstorming — clean white backgrounds, blue accents, soft shadows.

All 30 token keys must be filled with hex values.

- [ ] **Step 5: Create Rose Pine palette**

Create `src/core/theme/palettes/rosePine.ts`. Reference the official Rose Pine color palette:
- **Dark (Rose Pine)**: base `#191724`, surface `#1f1d2e`, overlay `#26233a`, text `#e0def4`, muted `#6e6a86`, subtle `#908caa`, love `#eb6f92`, gold `#f6c177`, rose `#ebbcba`, pine `#31748f`, foam `#9ccfd8`, iris `#c4a7e7`
- **Light (Rose Pine Dawn)**: base `#faf4ed`, surface `#fffaf3`, overlay `#f2e9e1`, text `#575279`, muted `#9893a5`, subtle `#797593`, love `#b4637a`, gold `#ea9d34`, rose `#d7827e`, pine `#286983`, foam `#56949f`, iris `#907aa9`

Map these to the 30 ThemeTokens keys.

- [ ] **Step 6: Create Catppuccin palette**

Create `src/core/theme/palettes/catppuccin.ts`. Reference the official Catppuccin palette:
- **Dark (Mocha)**: base `#1e1e2e`, mantle `#181825`, crust `#11111b`, text `#cdd6f4`, subtext `#a6adc8`, surface `#313244`, overlay `#45475a`, blue `#89b4fa`, lavender `#b4befe`, red `#f38ba8`, peach `#fab387`, green `#a6e3a1`, teal `#94e2d5`
- **Light (Latte)**: base `#eff1f5`, mantle `#e6e9ef`, crust `#dce0e8`, text `#4c4f69`, subtext `#6c6f85`, surface `#ccd0da`, overlay `#9ca0b0`, blue `#1e66f5`, lavender `#7287fd`, red `#d20f39`, peach `#fe640b`, green `#40a02b`, teal `#179299`

Map these to the 30 ThemeTokens keys.

- [ ] **Step 7: Create palette registry**

```typescript
// src/core/theme/palettes/index.ts
import { archcanvas } from './archcanvas';
import { rosePine } from './rosePine';
import { catppuccin } from './catppuccin';
import type { ThemePalette } from '../types';

export const palettes: ThemePalette[] = [archcanvas, rosePine, catppuccin];

export function findPalette(id: string): ThemePalette {
  return palettes.find((p) => p.id === id) ?? archcanvas;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run test/theme/types.test.ts`
Expected: PASS — all palette tokens validated

- [ ] **Step 9: Commit**

```bash
git add src/core/theme/ test/theme/types.test.ts
git commit -m "feat(theme): add theme types, 3 palette definitions, palette registry"
```

---

### Task 2: applyTheme — CSS Custom Property Application

**Files:**
- Create: `src/core/theme/applyTheme.ts`
- Test: `test/theme/applyTheme.test.ts`

- [ ] **Step 1: Write applyTheme tests**

```typescript
// test/theme/applyTheme.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTheme, camelToKebab, resolveMode, subscribeToSystemMode } from '@/core/theme/applyTheme';
import { archcanvas } from '@/core/theme/palettes/archcanvas';

describe('camelToKebab', () => {
  it('converts simple camelCase', () => {
    expect(camelToKebab('cardForeground')).toBe('card-foreground');
  });
  it('converts multi-segment', () => {
    expect(camelToKebab('nodeSelectedBorder')).toBe('node-selected-border');
  });
  it('handles single word', () => {
    expect(camelToKebab('background')).toBe('background');
  });
});

describe('resolveMode', () => {
  it('returns light when mode is light', () => {
    expect(resolveMode('light')).toBe('light');
  });
  it('returns dark when mode is dark', () => {
    expect(resolveMode('dark')).toBe('dark');
  });
  it('returns light when system and prefers-color-scheme is light', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    expect(resolveMode('system')).toBe('light');
  });
  it('returns dark when system and prefers-color-scheme is dark', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    expect(resolveMode('system')).toBe('dark');
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    // Clear any inline styles from previous test
    document.documentElement.style.cssText = '';
  });

  it('sets --color-background on html', () => {
    applyTheme(archcanvas, 'dark', 'medium');
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(archcanvas.dark.background);
  });

  it('sets --color-node-bg on html', () => {
    applyTheme(archcanvas, 'light', 'medium');
    expect(document.documentElement.style.getPropertyValue('--color-node-bg')).toBe(archcanvas.light.nodeBg);
  });

  it('sets font-size for small', () => {
    applyTheme(archcanvas, 'dark', 'small');
    expect(document.documentElement.style.fontSize).toBe('13px');
  });

  it('sets font-size for medium', () => {
    applyTheme(archcanvas, 'dark', 'medium');
    expect(document.documentElement.style.fontSize).toBe('15px');
  });

  it('sets font-size for large', () => {
    applyTheme(archcanvas, 'dark', 'large');
    expect(document.documentElement.style.fontSize).toBe('17px');
  });
});

describe('subscribeToSystemMode', () => {
  it('returns unsubscribe function', () => {
    const mockMql = { addEventListener: vi.fn(), removeEventListener: vi.fn(), matches: false } as unknown as MediaQueryList;
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql);
    const unsub = subscribeToSystemMode(() => {});
    expect(mockMql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    unsub();
    expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/theme/applyTheme.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement applyTheme.ts**

```typescript
// src/core/theme/applyTheme.ts
import type { ThemePalette } from './types';

type Mode = 'light' | 'dark' | 'system';
type TextSize = 'small' | 'medium' | 'large';

const TEXT_SIZE_MAP: Record<TextSize, string> = {
  small: '13px',
  medium: '15px',
  large: '17px',
};

/**
 * Convert camelCase token name to kebab-case CSS custom property suffix.
 * e.g. 'cardForeground' → 'card-foreground'
 */
export function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
}

/**
 * Resolve 'system' mode to 'light' or 'dark' based on prefers-color-scheme.
 */
export function resolveMode(mode: Mode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply palette tokens and text size to document.documentElement.
 */
export function applyTheme(palette: ThemePalette, resolvedMode: 'light' | 'dark', textSize: TextSize): void {
  if (typeof document === 'undefined') return;

  const tokens = resolvedMode === 'dark' ? palette.dark : palette.light;
  const el = document.documentElement;

  for (const [key, value] of Object.entries(tokens)) {
    el.style.setProperty(`--color-${camelToKebab(key)}`, value);
  }

  el.style.fontSize = TEXT_SIZE_MAP[textSize];
}

/**
 * Subscribe to OS dark/light mode changes. Returns unsubscribe function.
 */
export function subscribeToSystemMode(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/theme/applyTheme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/theme/applyTheme.ts test/theme/applyTheme.test.ts
git commit -m "feat(theme): add applyTheme with CSS var injection, mode resolution, system listener"
```

---

### Task 3: ThemeStore — Zustand Store with localStorage

**Files:**
- Create: `src/store/themeStore.ts`
- Test: `test/store/themeStore.test.ts`

- [ ] **Step 1: Write themeStore tests**

```typescript
// test/store/themeStore.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const STORAGE_KEY = 'archcanvas:theme';

// Must re-import to reset module state between tests
let useThemeStore: typeof import('@/store/themeStore').useThemeStore;

describe('themeStore', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.style.cssText = '';
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    useThemeStore = mod.useThemeStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct defaults', () => {
    const state = useThemeStore.getState();
    expect(state.palette).toBe('archcanvas');
    expect(state.mode).toBe('system');
    expect(state.textSize).toBe('medium');
  });

  it('setPalette updates state and persists', () => {
    useThemeStore.getState().setPalette('rose-pine');
    expect(useThemeStore.getState().palette).toBe('rose-pine');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.palette).toBe('rose-pine');
  });

  it('setMode updates state and persists', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.mode).toBe('dark');
  });

  it('setTextSize updates state and persists', () => {
    useThemeStore.getState().setTextSize('large');
    expect(useThemeStore.getState().textSize).toBe('large');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.textSize).toBe('large');
  });

  it('restores from localStorage on creation', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'catppuccin', mode: 'light', textSize: 'small',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.palette).toBe('catppuccin');
    expect(state.mode).toBe('light');
    expect(state.textSize).toBe('small');
  });

  it('falls back to defaults on corrupt localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json!!!');
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.palette).toBe('archcanvas');
  });

  it('falls back to archcanvas if stored palette id is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'nonexistent', mode: 'dark', textSize: 'medium',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    // Store should accept the id — findPalette handles fallback at apply time
    expect(mod.useThemeStore.getState().palette).toBe('nonexistent');
  });

  it('getResolvedMode returns mode directly for light/dark', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().getResolvedMode()).toBe('dark');
  });

  it('getResolvedMode resolves system mode', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().getResolvedMode()).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/store/themeStore.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement themeStore.ts**

Follow the Zustand pattern used in existing stores (see `src/store/uiStore.ts` and `src/store/fileStore.ts` localStorage helpers).

Key implementation details:
- `create<ThemeState & ThemeActions>((set, get) => ({...}))` pattern
- Load initial state from `localStorage.getItem('archcanvas:theme')` with try/catch + JSON.parse
- Each setter calls `set({...})` then `persistTheme(get())` then `applyThemeFromStore(get())`
- `applyThemeFromStore` calls `findPalette(state.palette)` then `applyTheme(palette, resolvedMode, textSize)`
- `getResolvedMode` uses `resolveMode(get().mode)` from applyTheme module
- Module-level side effect: after store creation, call `applyThemeFromStore` once + set up system mode listener if mode is 'system'
- Subscribe to store changes to manage system mode listener lifecycle

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/store/themeStore.test.ts`
Expected: PASS

- [ ] **Step 5: Run all existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All ~985 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/store/themeStore.ts test/store/themeStore.test.ts
git commit -m "feat(theme): add themeStore with localStorage persistence, system mode listener"
```

---

## Chunk 2: CSS Migration & Visual Polish

### Task 4: Font Loading

**Files:**
- Create: `public/fonts/inter/` (woff2 files)
- Create: `public/fonts/monaspace-argon/` (woff2 files)
- Modify: `src/index.css`

- [ ] **Step 1: Download Inter font files**

Download Inter woff2 files (400, 500, 600 weights) from the official release:

```bash
mkdir -p public/fonts/inter
# Download from Google Fonts API or rsms/inter GitHub releases
# Need: Inter-Regular.woff2, Inter-Medium.woff2, Inter-SemiBold.woff2
```

Use the latest Inter release from https://github.com/rsms/inter/releases — download the zip, extract the woff2 files for weights 400, 500, 600.

- [ ] **Step 2: Download Monaspace Argon font files**

Download Monaspace Argon woff2 files (400, 500 weights):

```bash
mkdir -p public/fonts/monaspace-argon
# Download from https://github.com/githubnext/monaspace/releases
# Need: MonaspaceArgon-Regular.woff2, MonaspaceArgon-Medium.woff2
```

- [ ] **Step 3: Add @font-face declarations and update index.css**

At the top of `src/index.css` (after the `@import` lines, before `@theme`), add:

```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter/Inter-Regular.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/inter/Inter-Medium.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter/Inter-SemiBold.woff2') format('woff2');
}
@font-face {
  font-family: 'Monaspace Argon';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/monaspace-argon/MonaspaceArgon-Regular.woff2') format('woff2');
}
@font-face {
  font-family: 'Monaspace Argon';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/monaspace-argon/MonaspaceArgon-Medium.woff2') format('woff2');
}
```

In the `@theme` block, add:
```css
--font-family-mono: 'Monaspace Argon', ui-monospace, monospace;
```

Update `--radius` to `0.625rem`.

Add canvas token defaults to `@theme`:
```css
--color-node-bg: #ffffff;
--color-node-border: #d1d5db;
--color-node-shadow: rgba(0, 0, 0, 0.08);
--color-node-selected-border: #2563eb;
--color-node-selected-ring: rgba(37, 99, 235, 0.25);
--color-node-ref-bg: #f9fafb;
--color-node-ref-border: #6b7280;
--color-edge-sync: #374151;
--color-edge-async: #6366f1;
--color-edge-default: #9ca3af;
--color-canvas-dot: #222222;
```

Update `body` font-family:
```css
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 4: Add `font-mono` to components displaying code/technical content**

Add the Tailwind `font-mono` class to elements that should use Monaspace Argon:
- `src/components/panels/CodeRefsTab.tsx` — code reference text
- Property value displays in `src/components/panels/PropertiesTab.tsx` — where values are technical identifiers
- `src/components/panels/ChatToolCall.tsx` — tool call arguments/code
- `.arch-node-type` in `nodeShapes.css` — add `font-family: var(--font-family-mono)` (node type labels like "service", "microservice")

Only add to elements where monospace improves readability of technical content. Don't add to general UI text.

- [ ] **Step 5: Verify the app still renders correctly**

Run: `npx vite dev` and check the browser — fonts should load, existing theme should still work.

- [ ] **Step 5: Commit**

```bash
git add public/fonts/ src/index.css
git commit -m "feat(theme): add Inter + Monaspace Argon fonts, canvas tokens in @theme"
```

---

### Task 5: CSS Variable Migration — Node Shapes

**Prerequisite:** Task 4 must be complete (canvas tokens added to `@theme`).

**Files:**
- Modify: `src/components/nodes/nodeShapes.css`

- [ ] **Step 1: Replace hardcoded colors in nodeShapes.css**

Replace all hardcoded hex colors with CSS custom property references. Key replacements:

| Line(s) | Current | New |
|---------|---------|-----|
| 9 | `background-color: #ffffff` | `background-color: var(--color-node-bg)` |
| 10 | `border: 1.5px solid #d1d5db` | `border: 1.5px solid var(--color-node-border)` |
| 19 | `color: #111827` | `color: var(--color-foreground)` |
| 20 | `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08)` | `box-shadow: 0 1px 3px 0 var(--color-node-shadow)` |
| 31 | `border-color: #2563eb` | `border-color: var(--color-node-selected-border)` |
| 32 | `box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25)` | `box-shadow: 0 0 0 2px var(--color-node-selected-ring)` |
| 37 | `border-color: #6b7280` | `border-color: var(--color-node-ref-border)` |
| 38 | `background-color: #f9fafb` | `background-color: var(--color-node-ref-bg)` |
| 42 | `border-color: #2563eb` | `border-color: var(--color-node-selected-border)` |
| 107 | `background-color: #ffffff` (hexagon) | `background-color: var(--color-node-bg)` |
| 130 | `border: 1.5px solid #d1d5db` (cloud) | `border: 1.5px solid var(--color-node-border)` |
| 162 | `border: 1.5px solid #d1d5db` (document pseudo) | `border-left/right: 1.5px solid var(--color-node-border)` |
| 164, 169-175 | `#d1d5db` in document gradient | `var(--color-node-border)` |
| 197 | `border: 2px solid #d1d5db` (container) | `border: 2px solid var(--color-node-border)` |
| 198 | `outline: 2px solid #d1d5db` | `outline: 2px solid var(--color-node-border)` |
| 203 | `background-color: rgba(249, 250, 251, 0.7)` (container) | `background-color: color-mix(in srgb, var(--color-node-ref-bg) 70%, transparent)` |
| 207-208 | `#2563eb` (container selected) | `var(--color-node-selected-border)` |
| 240 | `color: #6b7280` (.arch-node-type) | `color: var(--color-muted-foreground)` |

**Do NOT change** `.arch-node.unknown-type` (lines 45-48) or `.arch-node-warning` (lines 246-258) — these stay hardcoded as semantic warning colors.

- [ ] **Step 2: Verify visually**

Run: `npx vite dev` and check that nodes still render correctly with the CSS variable fallbacks from `@theme`.

- [ ] **Step 3: Commit**

```bash
git add src/components/nodes/nodeShapes.css
git commit -m "refactor(theme): migrate nodeShapes.css hardcoded colors to CSS vars"
```

---

### Task 6: CSS Variable Migration — Edge Protocols

**Prerequisite:** Task 4 must be complete (canvas tokens added to `@theme`).

**Files:**
- Modify: `src/components/edges/EdgeRenderer.css`

- [ ] **Step 1: Replace hardcoded colors in EdgeRenderer.css**

| Line(s) | Current | New |
|---------|---------|-----|
| 3 | `stroke: #374151` (.edge-sync) | `stroke: var(--color-edge-sync)` |
| 10 | `stroke: #6366f1` (.edge-async) | `stroke: var(--color-edge-async)` |
| 19 | `stroke: #9ca3af` (.edge-default) | `stroke: var(--color-edge-default)` |
| 35 | `background: #ffffff` (.edge-label) | `background: var(--color-card)` |
| 36 | `border: 1px solid #e5e7eb` | `border: 1px solid var(--color-border)` |
| 41 | `color: #374151` | `color: var(--color-foreground)` |
| 55 | `background: #f3f4f6` (.entity-pill) | `background: var(--color-muted)` |
| 56 | `border: 1px solid #d1d5db` | `border: 1px solid var(--color-border)` |
| 60 | `color: #6b7280` | `color: var(--color-muted-foreground)` |
| 77 | `var(--color-border-muted, #6b7280)` (.ghost-node) | `var(--color-border)` |
| 78 | `var(--color-bg-muted, #f3f4f6)` | `var(--color-muted)` |
| 83 | `var(--color-text-muted, #9ca3af)` | `var(--color-muted-foreground)` |

- [ ] **Step 2: Verify edges render correctly**

Run: `npx vite dev`, open a project with edges, verify sync/async/default styles.

- [ ] **Step 3: Commit**

```bash
git add src/components/edges/EdgeRenderer.css
git commit -m "refactor(theme): migrate EdgeRenderer.css hardcoded colors to CSS vars"
```

---

### Task 7: Resize Handle Polish

**Files:**
- Modify: `src/components/ui/resizable.tsx`
- Modify: `src/App.tsx` (remove `withHandle` prop)

- [ ] **Step 1: Replace grip icon with invisible hover-line handle**

Update `ResizableHandle` in `src/components/ui/resizable.tsx`:

Remove the `withHandle` prop and `GripVerticalIcon` import. Replace the inner handle div with a hover-line approach:

```tsx
function ResizableHandle({
  className,
  ...props
}: ResizablePrimitive.SeparatorProps) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "group relative flex w-[5px] items-center justify-center bg-transparent after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden cursor-col-resize aria-[orientation=horizontal]:h-[5px] aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2",
        className
      )}
      {...props}
    >
      <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-primary opacity-0 transition-opacity duration-150 group-hover:opacity-30 aria-[orientation=horizontal]:inset-x-0 aria-[orientation=horizontal]:inset-y-auto aria-[orientation=horizontal]:top-1/2 aria-[orientation=horizontal]:h-[2px] aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:-translate-y-1/2 aria-[orientation=horizontal]:translate-x-0" />
    </ResizablePrimitive.Separator>
  )
}
```

Key changes:
- Removed `GripVerticalIcon` import and `withHandle` prop
- Container: `w-[5px]`, `bg-transparent`, `cursor-col-resize`, added `group` class
- Inner div: 2px line, `opacity-0` at rest, `group-hover:opacity-30` on hover, `transition-opacity duration-150`

- [ ] **Step 2: Update App.tsx — remove `withHandle` props**

In `src/App.tsx`, change both `<ResizableHandle withHandle />` to `<ResizableHandle />` (lines 116, 120).

- [ ] **Step 3: Verify resize handles work**

Run: `npx vite dev`, hover over panel borders — should see faint line appear, should be able to resize.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/resizable.tsx src/App.tsx
git commit -m "polish(theme): replace grip icon with invisible hover-line resize handles"
```

---

### Task 8: Hardcoded Color Audit

**Files:**
- Modify: various components with hardcoded hex colors

- [ ] **Step 1: Search for remaining hardcoded hex values**

Run a grep across all `.tsx` and `.css` files in `src/` for hardcoded hex colors:

```bash
npx vitest run  # Verify baseline passes first
```

Then search for `#[0-9a-fA-F]{3,8}` patterns in `src/` (excluding the palette definition files and nodeShapes/EdgeRenderer which are already done). Fix any instances that should use CSS vars instead.

Key areas to audit:
- `src/components/layout/StatusBar.tsx`
- `src/components/shared/Breadcrumb.tsx`
- `src/components/shared/ContextMenu.tsx`
- `src/components/canvas/Canvas.tsx` (ReactFlow background dots)
- Any component with inline `style={{ color: '#...' }}`

For ReactFlow background dots in Canvas.tsx, use `var(--color-canvas-dot)` or pass the CSS variable value as a prop.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(theme): audit and replace remaining hardcoded colors with CSS vars"
```

---

## Chunk 3: Settings UI

### Task 9: uiStore Dialog State

**Files:**
- Modify: `src/store/uiStore.ts`

- [ ] **Step 1: Add Appearance dialog state to uiStore**

Add to `UiState` interface:
```typescript
showAppearanceDialog: boolean;
openAppearanceDialog: () => void;
closeAppearanceDialog: () => void;
```

Add to the store implementation:
```typescript
showAppearanceDialog: false,
openAppearanceDialog: () => set({ showAppearanceDialog: true }),
closeAppearanceDialog: () => set({ showAppearanceDialog: false }),
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All pass (no existing tests break)

- [ ] **Step 3: Commit**

```bash
git add src/store/uiStore.ts
git commit -m "feat(theme): add showAppearanceDialog state to uiStore"
```

---

### Task 10: shadcn/ui Dialog Component

**Files:**
- Create: `src/components/ui/dialog.tsx`

- [ ] **Step 1: Install Radix UI dialog dependency**

```bash
npm install @radix-ui/react-dialog
```

- [ ] **Step 2: Create dialog.tsx**

Use the standard shadcn/ui Dialog component. This is a wrapper around `@radix-ui/react-dialog` with Tailwind styling. Follow the same pattern as existing shadcn/ui components in `src/components/ui/`.

Key exports: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogClose`.

Styling: overlay backdrop with blur, centered content panel with `bg-card`, `border-border`, rounded corners, animation (fade in + scale).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dialog.tsx package.json package-lock.json
git commit -m "feat(ui): add shadcn/ui Dialog component"
```

---

### Task 11: Appearance Dialog

**Files:**
- Create: `src/components/AppearanceDialog.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create AppearanceDialog component**

```typescript
// src/components/AppearanceDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUiStore } from '@/store/uiStore';
import { useThemeStore } from '@/store/themeStore';
import { palettes } from '@/core/theme/palettes';
import { Sun, Moon, Monitor } from 'lucide-react';
```

Component structure:
- Reads `showAppearanceDialog` from `uiStore`
- Reads `palette`, `mode`, `textSize` from `themeStore`
- **Color Palette section**: Row of clickable cards with `data-palette={palette.id}` attribute. Each shows palette name + 4 color swatches (key colors from the palette). Highlight current selection with accent border + check mark.
- **Mode section**: Three toggle buttons — Sun (Light), Moon (Dark), Monitor (System). Current mode highlighted.
- **Text Size section**: Three toggle buttons with `data-text-size="small"`, `data-text-size="medium"`, `data-text-size="large"` attributes — labeled S, M, L. Current size highlighted.
- All changes call `themeStore` setters directly — live preview, no save button.
- Dialog `onOpenChange` calls `closeAppearanceDialog()`.

Color swatches per palette: show 4 dots using `palette.dark.primary`, `palette.dark.accent`, `palette.dark.edgeAsync`, `palette.dark.nodeSelectedBorder` (or light variant based on current mode).

**Important data attributes**: The E2E tests (Task 16) depend on `[data-palette="rose-pine"]` and `[data-text-size="small"]` selectors. Ensure these are added to the palette cards and text size buttons.

- [ ] **Step 2: Mount AppearanceDialog in App.tsx**

In `src/App.tsx`:

1. Add a bare import at the top of the file (before the component) to ensure the theme is applied on all routes — not just when the main layout renders:
```tsx
import '@/store/themeStore'; // side-effect: applies theme on import
```

2. Import and add `<AppearanceDialog />` inside the main layout (after `<StatusBar />`), inside the `TooltipProvider` wrapper:
```tsx
import { AppearanceDialog } from '@/components/AppearanceDialog';
// ... in the return:
<StatusBar />
<AppearanceDialog />
```

- [ ] **Step 3: Verify dialog opens and works**

Run: `npx vite dev`. Open browser console, run:
```javascript
// Simulate opening the dialog
window.__uiStore = /* get store reference */
```

Or temporarily add a button to test. We'll wire up real triggers in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppearanceDialog.tsx src/App.tsx
git commit -m "feat(theme): add AppearanceDialog with live palette/mode/textSize controls"
```

---

### Task 12: Toolbar Theme Toggle

**Files:**
- Modify: `src/components/layout/LeftToolbar.tsx`

- [ ] **Step 1: Add theme toggle button to LeftToolbar**

Import `Sun`, `Moon`, `Monitor` from `lucide-react` and `useThemeStore`.

At the top of the `LeftToolbar` component, add reactive subscriptions:

```typescript
const themeMode = useThemeStore((s) => s.mode);
const resolvedMode = useThemeStore((s) => s.getResolvedMode());

// Pre-compute icon and label for the theme toggle
const themeIcon = themeMode === 'system' ? Monitor : resolvedMode === 'dark' ? Moon : Sun;
const themeLabel = themeMode === 'system' ? 'System (auto)' : themeMode === 'dark' ? 'Dark mode' : 'Light mode';
```

Then add a new tool entry after the AI Chat button in the `tools` array:

```typescript
{
  icon: themeIcon,
  label: themeLabel,
  shortcut: '',
  onClick: () => {
    const { mode, setMode } = useThemeStore.getState();
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setMode(next);
  },
}
```

- [ ] **Step 2: Verify toggle works**

Run: `npx vite dev`. Click the new toggle button — should cycle Light → Dark → System. Observe the app theme changing live.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/LeftToolbar.tsx
git commit -m "feat(theme): add light/dark/system toggle button to toolbar"
```

---

### Task 13: Command Palette & View Menu Integration

**Files:**
- Modify: `src/components/shared/CommandPalette.tsx`
- Modify: `src/components/layout/TopMenubar.tsx`

- [ ] **Step 1: Add "Appearance..." command to CommandPalette**

In `src/components/shared/CommandPalette.tsx`, add to the `viewActions` array:

```typescript
{
  id: 'action:appearance',
  title: 'Appearance…',
  subtitle: 'Theme, mode, text size',
  icon: '🎨',
  category: 'View',
  execute: () => useUiStore.getState().openAppearanceDialog(),
},
```

Import `useUiStore` if not already imported (it is — line 13).

- [ ] **Step 2: Add "Appearance..." menu item to TopMenubar**

In `src/components/layout/TopMenubar.tsx`, add a separator and menu item at the end of the View menu:

```tsx
<MenubarSeparator />
<MenubarItem onClick={() => useUiStore.getState().openAppearanceDialog()}>
  Appearance…
</MenubarItem>
```

Import `useUiStore` if not already imported.

- [ ] **Step 3: Verify both triggers open the dialog**

Run: `npx vite dev`. Open Command Palette (⌘K), type "appearance" — should show and trigger dialog. Click View > Appearance… — should open dialog.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/CommandPalette.tsx src/components/layout/TopMenubar.tsx
git commit -m "feat(theme): add Appearance command to palette and View menu"
```

---

## Chunk 4: Integration & Polish

### Task 14: Flash Prevention Script

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add synchronous theme script to `<head>`**

Add a `<script>` tag in the `<head>` of `index.html`, after the `<meta>` tags and before any other scripts:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>ArchCanvas</title>
  <script>
    // Flash prevention: apply theme before first paint
    (function() {
      var DEFAULTS = { palette: 'archcanvas', mode: 'system', textSize: 'medium' };
      var TEXT_SIZES = { small: '13px', medium: '15px', large: '17px' };

      // Minimal palette data — compact copy of src/core/theme/palettes/*.ts
      // Keys are kebab-case CSS property names (without --color- prefix).
      // MAINTENANCE: When palette colors change, update both the TS files AND this object.
      // See: src/core/theme/palettes/archcanvas.ts, rosePine.ts, catppuccin.ts
      var PALETTES = {
        'archcanvas': {
          light: { background: '#fafafe', foreground: '#1a1a2e', card: '#ffffff', /* ... all 30 tokens */ },
          dark:  { background: '#09090b', foreground: '#fafafa', card: '#18181b', /* ... all 30 tokens */ }
        },
        'rose-pine': {
          light: { background: '#faf4ed', foreground: '#575279', card: '#fffaf3', /* ... all 30 tokens */ },
          dark:  { background: '#191724', foreground: '#e0def4', card: '#1f1d2e', /* ... all 30 tokens */ }
        },
        'catppuccin': {
          light: { background: '#eff1f5', foreground: '#4c4f69', card: '#e6e9ef', /* ... all 30 tokens */ },
          dark:  { background: '#1e1e2e', foreground: '#cdd6f4', card: '#181825', /* ... all 30 tokens */ }
        }
        // Populate ALL 30 token keys per mode from the corresponding palette TS files.
        // Use kebab-case: 'card-foreground', 'node-bg', 'edge-sync', etc.
      };

      try {
        var stored = JSON.parse(localStorage.getItem('archcanvas:theme') || '{}');
        var palette = stored.palette || DEFAULTS.palette;
        var mode = stored.mode || DEFAULTS.mode;
        var textSize = stored.textSize || DEFAULTS.textSize;
      } catch(e) {
        var palette = DEFAULTS.palette;
        var mode = DEFAULTS.mode;
        var textSize = DEFAULTS.textSize;
      }

      // Resolve system mode
      var resolved = mode;
      if (mode === 'system') {
        try {
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch(e) {
          resolved = 'light';
        }
      }

      // Apply text size
      document.documentElement.style.fontSize = TEXT_SIZES[textSize] || TEXT_SIZES.medium;

      // Apply palette colors
      var tokens = (PALETTES[palette] || PALETTES.archcanvas || {})[resolved];
      if (tokens) {
        for (var key in tokens) {
          document.documentElement.style.setProperty('--color-' + key, tokens[key]);
        }
      }
    })();
  </script>
</head>
```

**Important**: The `PALETTES` object must be populated with the actual palette token values. This creates a small duplication between the inline script and the TypeScript palette files, but it's necessary for flash prevention (~1-2KB total).

During implementation, generate the PALETTES object from the TypeScript palette files — convert each palette's light/dark tokens to kebab-case keys matching the CSS custom property names.

- [ ] **Step 2: Verify flash prevention**

Run: `npx vite dev`. Set theme to Rose Pine Light via the Appearance dialog. Hard refresh the page — should NOT see a flash of the default dark theme before Rose Pine loads.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(theme): add flash prevention script in index.html head"
```

---

### Task 15: ReactFlow Controls Styling

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Update ReactFlow controls CSS**

The existing controls CSS in `src/index.css` (lines 40-62) already uses CSS variables — these will automatically adapt when the palette changes. Review and enhance:

```css
.react-flow__controls {
  background: transparent;
  border: none;
  box-shadow: none;
}

.react-flow__controls-button {
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  fill: var(--color-muted-foreground);
  color: var(--color-muted-foreground);
  border-radius: 6px;
}

.react-flow__controls-button:hover {
  background-color: var(--color-accent);
  fill: var(--color-accent-foreground);
  color: var(--color-accent-foreground);
}

.react-flow__controls-button svg {
  fill: inherit;
}
```

Key change: add `border-radius: 6px` to the button for consistent rounded corners.

Also add a CSS override for the ReactFlow background dots — the `<Background>` component's `color` prop only accepts actual color strings, so use CSS instead:

```css
.react-flow__background pattern circle {
  fill: var(--color-canvas-dot);
}
```

This automatically updates when the theme changes, with no JS needed.

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "polish(theme): refine ReactFlow controls styling with rounded corners"
```

---

### Task 16: E2E Tests

**Files:**
- Create or modify: `test/e2e/theme.spec.ts`

- [ ] **Step 1: Write E2E tests for theme system**

```typescript
// test/e2e/theme.spec.ts
import { test, expect } from '@playwright/test';
import { gotoApp } from './e2e-helpers';

test.describe('Theme System', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and navigate to app (bypasses ProjectGate)
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await gotoApp(page);
  });

  test('default theme applies correctly', async ({ page }) => {
    const fontSize = await page.evaluate(() =>
      document.documentElement.style.fontSize
    );
    expect(fontSize).toBe('15px'); // medium default
  });

  test('Appearance dialog opens from View menu', async ({ page }) => {
    await page.click('text=View');
    await page.click('text=Appearance');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('palette switch changes CSS variables', async ({ page }) => {
    // Open Appearance dialog
    await page.click('text=View');
    await page.click('text=Appearance');

    // Click Rose Pine palette card
    await page.click('[data-palette="rose-pine"]');

    // Verify CSS variable changed
    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-background')
    );
    expect(bg).toBeTruthy();
    expect(bg).not.toBe('#09090b'); // Not the default dark zinc
  });

  test('mode toggle cycles light → dark → system', async ({ page }) => {
    // Find the theme toggle button in the toolbar
    const toggleBtn = page.locator('button[aria-label*="mode"]').first();

    // Click to cycle modes and verify CSS changes
    await toggleBtn.click(); // light → dark
    await toggleBtn.click(); // dark → system
    await toggleBtn.click(); // system → light
  });

  test('text size change updates html font-size', async ({ page }) => {
    await page.click('text=View');
    await page.click('text=Appearance');

    // Click Small text size
    await page.click('[data-text-size="small"]');
    const smallSize = await page.evaluate(() =>
      document.documentElement.style.fontSize
    );
    expect(smallSize).toBe('13px');

    // Click Large text size
    await page.click('[data-text-size="large"]');
    const largeSize = await page.evaluate(() =>
      document.documentElement.style.fontSize
    );
    expect(largeSize).toBe('17px');
  });

  test('preferences persist across reload', async ({ page }) => {
    // Open dialog and switch to Rose Pine
    await page.click('text=View');
    await page.click('text=Appearance');
    await page.click('[data-palette="rose-pine"]');

    // Close dialog and reload
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForSelector('[data-slot="resizable-panel-group"]');

    // Verify palette persisted
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('archcanvas:theme') || '{}')
    );
    expect(stored.palette).toBe('rose-pine');
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `npx playwright test test/e2e/theme.spec.ts`
Expected: PASS

Note: E2E tests require `vite preview` to be running. Follow the existing E2E setup pattern in `test/setup/playwrightSlotGuard.ts`.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run && npx playwright test`
Expected: All unit + E2E tests pass

- [ ] **Step 4: Commit**

```bash
git add test/e2e/theme.spec.ts
git commit -m "test(theme): add E2E tests for palette switch, mode toggle, text size, persistence"
```

---

### Task 17: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run && npx playwright test
```

All tests must pass.

- [ ] **Step 2: Manual verification checklist**

Open `npx vite dev` and verify:
- [ ] ArchCanvas Default light + dark look correct
- [ ] Rose Pine light + dark look correct
- [ ] Catppuccin light + dark look correct
- [ ] Text size S/M/L all apply correctly
- [ ] System mode follows OS preference
- [ ] Toolbar toggle cycles correctly with icon updates
- [ ] Command Palette "Appearance..." opens dialog
- [ ] View > Appearance... opens dialog
- [ ] Resize handles are invisible at rest, show on hover
- [ ] ReactFlow controls match current palette
- [ ] Node shapes render correctly in all palettes
- [ ] Edge protocols render correctly in all palettes
- [ ] Flash prevention works on hard refresh
- [ ] Inter font renders in UI chrome
- [ ] Monaspace Argon renders for code/mono text

- [ ] **Step 3: Final commit**

If any fixups were needed, commit them:

```bash
git add -A
git commit -m "fix(theme): final polish and verification fixes"
```
