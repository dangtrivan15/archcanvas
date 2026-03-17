# Icon 3D Depth Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder favicon and Tauri icon with the new v2 icon featuring atmospheric perspective depth.

**Architecture:** The source SVG is already written at `docs/icon-brainstorm/favorite-60deg-canvas-v2.svg`. Copy it to `public/favicon.svg` for web use. Convert to PNG for Tauri desktop icon. No code changes — only static asset replacement.

**Tech Stack:** SVG (source of truth), `resvg` or `rsvg-convert` for SVG→PNG conversion.

**Spec:** [docs/specs/2026-03-17-icon-3d-depth-design.md](../specs/2026-03-17-icon-3d-depth-design.md)

---

## Chunk 1: Asset Replacement

### Task 1: Replace Web Favicon

**Files:**
- Modify: `public/favicon.svg`
- Source: `docs/icon-brainstorm/favorite-60deg-canvas-v2.svg`

- [ ] **Step 1: Copy v2 SVG to favicon location**

Copy the content of `docs/icon-brainstorm/favorite-60deg-canvas-v2.svg` to `public/favicon.svg`, replacing the old placeholder.

The SVG uses a 128×128 viewBox which scales cleanly to any size. The `<link>` in `index.html` already references `/favicon.svg` — no HTML changes needed.

- [ ] **Step 2: Verify favicon renders in browser**

Run: `npx vite preview` (or `npx vite dev`)

Open the app and check the browser tab icon. It should show the new v2 icon with the three colored objects on the dot grid.

- [ ] **Step 3: Commit**

```bash
git add public/favicon.svg
git commit -m "feat(icon): replace placeholder favicon with v2 atmospheric perspective icon"
```

### Task 2: Generate Tauri Desktop Icon (PNG)

**Files:**
- Modify: `src-tauri/icons/icon.png`

- [ ] **Step 1: Check available SVG→PNG conversion tool**

Try in order:
```bash
which rsvg-convert   # from librsvg (brew install librsvg)
which resvg          # from resvg (cargo install resvg)
```

If neither is available, install one:
```bash
brew install librsvg   # preferred — fast, well-supported on macOS
```

- [ ] **Step 2: Convert SVG to 1024×1024 PNG**

Using rsvg-convert:
```bash
rsvg-convert -w 1024 -h 1024 docs/icon-brainstorm/favorite-60deg-canvas-v2.svg -o src-tauri/icons/icon.png
```

Or using resvg:
```bash
resvg --width 1024 --height 1024 docs/icon-brainstorm/favorite-60deg-canvas-v2.svg src-tauri/icons/icon.png
```

Tauri 2.0 accepts a single `icon.png` and generates platform-specific sizes during build.

- [ ] **Step 3: Verify PNG renders correctly**

```bash
open src-tauri/icons/icon.png   # macOS Preview
```

Confirm: three colored objects (purple human, gold AI, teal canvas), dot grid with atmospheric fade, breadcrumb in corner, gradient edges, thin border visible.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/icons/icon.png
git commit -m "feat(icon): generate Tauri desktop icon from v2 SVG"
```
