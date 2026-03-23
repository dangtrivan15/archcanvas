# Repo Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `src/` → `src-web/`, flatten `landing/` → `src-landing/`, merge landing's `package.json` into root, merge duplicate `public/` dirs, and update all path references.

**Architecture:** Directory renames + config path updates. `src-tauri/` stays as-is (Tauri CLI convention). All web app imports use `@/*` alias — updating tsconfig + vite alias covers them. ~28 test files use relative `../../src/` imports that need updating to `../../src-web/`. Landing loses its own `package.json`/configs — gets root-level `vite.config.landing.ts` and `tsconfig.landing.json` instead. Landing's deps are already a subset of root's.

**Tech Stack:** git mv, config path updates in ~12 files

---

### Task 1: Directory moves and public merge

**Files:**
- Move: `src/` → `src-web/`
- Move: `landing/src/` → `src-landing/` (source only, configs handled later)
- Move: `landing/test/` → `test/landing/` (colocate all tests)
- Move: `landing/index.html` → `src-landing/index.html`
- Delete: `landing/` (after extracting everything)
- Merge: `landing/public/` into root `public/`

- [ ] **Step 1: Move src → src-web**

```bash
git mv src src-web
```

- [ ] **Step 2: Move landing source to src-landing**

```bash
git mv landing/src src-landing
```

- [ ] **Step 3: Move landing tests under root test/**

```bash
mkdir -p test/landing
git mv landing/test/e2e/landing.spec.ts test/landing/landing.spec.ts
```

- [ ] **Step 4: Move landing index.html into src-landing**

```bash
git mv landing/index.html src-landing/index.html
```

- [ ] **Step 5: Update src-landing/index.html entry point**

Since Vite `root` will be `src-landing/`, the script path is now relative to that:

```diff
-    <script type="module" src="/src/main.tsx"></script>
+    <script type="module" src="/main.tsx"></script>
```

- [ ] **Step 6: Remove landing/public (duplicates already in root public/)**

All files verified identical via md5: `favicon.svg`, `fonts/inter/InterVariable.woff2`, `fonts/monaspace-argon/MonaspaceArgon-Regular.woff2`.

```bash
git rm -r landing/public
```

- [ ] **Step 7: Remove remaining landing scaffolding**

These are replaced by root-level configs in Task 3.

```bash
git rm landing/package.json landing/vite.config.ts landing/tsconfig.json landing/test/e2e/playwright.config.ts
```

If `landing/` dir still exists (e.g., `node_modules/` or other untracked files):

```bash
rm -rf landing
```

- [ ] **Step 8: Verify structure**

```bash
ls src-web/       # App.tsx, bridge/, components/, core/, hooks/, ...
ls src-tauri/     # Cargo.toml, src/, tauri.conf.json, ... (unchanged)
ls src-landing/   # App.tsx, components/, constants.ts, hooks/, index.css, index.html, main.tsx
ls test/landing/  # landing.spec.ts
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: rename src→src-web, extract landing→src-landing, merge public dirs"
```

---

### Task 2: Update root configs (src/ → src-web/)

**Files:**
- Modify: `index.html` (1 change)
- Modify: `vite.config.ts` (4 changes)
- Modify: `vite.config.bridge-sidecar.ts` (2 changes)
- Modify: `tsconfig.json` (2 changes)
- Modify: `tsconfig.test.json` (1 change)
- Modify: `vitest.config.ts` (1 change)
- Modify: `eslint.config.js` (1 change)
- Modify: `package.json` (2 script changes + merge landing deps)
- Modify: `components.json` (1 change)
- Modify: `.gitignore` (2 changes)

- [ ] **Step 1: Update `index.html`**

Line 12: Entry point
```diff
-    <script type="module" src="/src/main.tsx"></script>
+    <script type="module" src="/src-web/main.tsx"></script>
```

- [ ] **Step 2: Update `vite.config.ts`**

1. Lines 4-5: Import paths
```diff
-import { aiBridgePlugin, type AiBridgePluginOptions } from "./src/core/ai/vitePlugin";
-import { themeFlashPlugin } from "./src/core/theme/viteFlashPlugin";
+import { aiBridgePlugin, type AiBridgePluginOptions } from "./src-web/core/ai/vitePlugin";
+import { themeFlashPlugin } from "./src-web/core/theme/viteFlashPlugin";
```

2. Line 90: Resolve alias
```diff
-      "@": path.resolve(__dirname, "./src"),
+      "@": path.resolve(__dirname, "./src-web"),
```

3. Line 120: Watch ignore — `src-tauri` stays, but remove `src-tauri` reference anyway since it hasn't changed. Actually, keep as-is.

- [ ] **Step 3: Update `vite.config.bridge-sidecar.ts`**

1. Line 30: Resolve alias
```diff
-      '@': path.resolve(__dirname, './src'),
+      '@': path.resolve(__dirname, './src-web'),
```

2. Line 38: Entry path
```diff
-      entry: path.resolve(__dirname, 'src/bridge/index.ts'),
+      entry: path.resolve(__dirname, 'src-web/bridge/index.ts'),
```

- [ ] **Step 4: Update `tsconfig.json`**

1. Line 21: Path alias
```diff
-      "@/*": ["./src/*"]
+      "@/*": ["./src-web/*"]
```

2. Line 24: Include
```diff
-  "include": ["src", "vite.config.ts", "vitest.config.ts"],
+  "include": ["src-web", "vite.config.ts", "vitest.config.ts"],
```

Note: `"exclude": ["src-tauri"]` stays unchanged.

- [ ] **Step 5: Update `tsconfig.test.json`**

```diff
-  "include": ["src", "test"]
+  "include": ["src-web", "test"]
```

- [ ] **Step 6: Update `vitest.config.ts`**

Line 9: Resolve alias
```diff
-      "@": path.resolve(__dirname, "./src"),
+      "@": path.resolve(__dirname, "./src-web"),
```

- [ ] **Step 7: Update `eslint.config.js`**

No change needed — ignores `["dist", "src-tauri", "bak"]`. `src-tauri` stays.

- [ ] **Step 8: Update `package.json` scripts**

1. `build:sidecar` script:
```diff
-    "build:sidecar": "bun build --compile src/bridge/index.ts --outfile src-tauri/binaries/archcanvas-bridge-aarch64-apple-darwin",
+    "build:sidecar": "bun build --compile src-web/bridge/index.ts --outfile src-tauri/binaries/archcanvas-bridge-aarch64-apple-darwin",
```

2. `lint` script:
```diff
-    "lint": "eslint src/",
+    "lint": "eslint src-web/",
```

3. Add landing scripts:
```json
"dev:landing": "vite --config vite.config.landing.ts",
"build:landing": "tsc --noEmit -p tsconfig.landing.json && vite build --config vite.config.landing.ts",
"preview:landing": "vite preview --config vite.config.landing.ts"
```

- [ ] **Step 9: Update `components.json`**

Line 8: CSS path
```diff
-    "css": "src/index.css",
+    "css": "src-web/index.css",
```

- [ ] **Step 10: Update `.gitignore`**

1. Generated .d.ts section:
```diff
-src/**/*.d.ts
-!src/vite-env.d.ts
+src-web/**/*.d.ts
+!src-web/vite-env.d.ts
```

(`src-tauri/` entries stay unchanged.)

- [ ] **Step 11: Run typecheck**

```bash
npm run typecheck
```

Expected: passes with zero errors.

- [ ] **Step 12: Commit**

```bash
git add index.html vite.config.ts vite.config.bridge-sidecar.ts tsconfig.json tsconfig.test.json vitest.config.ts package.json components.json .gitignore
git commit -m "refactor: update root configs for src-web layout"
```

---

### Task 3: Create landing config files at root

**Files:**
- Create: `vite.config.landing.ts`
- Create: `tsconfig.landing.json`
- Create: `playwright.config.landing.ts`

- [ ] **Step 1: Create `vite.config.landing.ts`**

Vite's `root` determines where it looks for `index.html`. Since `index.html` is inside `src-landing/`, we set `root` accordingly:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src-landing'),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, 'dist-landing'),
    emptyOutDir: true,
  },
});
```

- [ ] **Step 2: Create `tsconfig.landing.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src-landing"]
}
```

- [ ] **Step 3: Verify landing builds**

```bash
npm run build:landing
```

Expected: builds successfully into `dist-landing/`, fonts and favicon resolve.

- [ ] **Step 4: Verify landing dev server**

```bash
npm run dev:landing &
sleep 3 && kill %1
```

Expected: Vite starts without errors.

- [ ] **Step 5: Create `playwright.config.landing.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/landing',
  use: {
    baseURL: 'http://localhost:4174',
  },
  webServer: {
    command: 'npm run build:landing && npx vite preview --config vite.config.landing.ts --port 4174',
    port: 4174,
    reuseExistingServer: true,
  },
});
```

Note: uses port 4174 to avoid conflicting with the web app's preview on 4173.

- [ ] **Step 6: Add `test:e2e-landing` script to `package.json`**

```json
"test:e2e-landing": "playwright test --config playwright.config.landing.ts"
```

- [ ] **Step 7: Add `dist-landing/` to `.gitignore`**

```diff
 # Build output
 dist/
+dist-landing/
```

- [ ] **Step 8: Commit**

```bash
git add vite.config.landing.ts tsconfig.landing.json playwright.config.landing.ts package.json .gitignore
git commit -m "refactor: add root-level landing configs (vite, tsconfig, playwright)"
```

---

### Task 4: Fix relative test imports (../../src/ → ../../src-web/)

**Files:**
- Modify: 11 test files with `../../src/` relative imports

These files use relative imports instead of the `@/` alias. Update them to point to `../../src-web/`:

- `test/ai/bridgeServer.test.ts` (2 imports)
- `test/ai/apiKeyProvider.test.ts` (1 import type + 6 `vi.mock()` + 3 dynamic `import()`)
- `test/ai/toolDefs.test.ts` (1 import + 1 `import()`)
- `test/ai/translateToolArgs.test.ts` (1 import)
- `test/ai/fileToolUtils.test.ts` (1 import)
- `test/store/apiKeyStore.test.ts` (1 import type + 2 `import()`)
- `test/platform/fileSystem-extensions.test.ts` (1 import)
- `test/components/AiSettingsDialog.test.tsx` (1 import)
- `test/components/canvas/inheritedEdges.test.ts` (1 import, path is `../../../src/`)
- `test/core/entity/resolver.test.ts` (2 imports, path is `../../../src/`)
- `test/e2e/mockSessionFactory.ts` (3 import types)

- [ ] **Step 1: Replace all `../../src/` with `../../src-web/` in test files**

For each file, find-and-replace `../../src/` → `../../src-web/`. For the deeper files (`test/components/canvas/`, `test/core/entity/`), replace `../../../src/` → `../../../src-web/`.

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: all ~1587 tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/
git commit -m "refactor: update relative test imports for src-web"
```

---

### Task 5: Update README and verify everything

**Files:**
- Modify: `README.md` (project structure section)

- [ ] **Step 1: Update README.md project structure references**

Update any references to `src/` → `src-web/` in the project structure diagram and build paths. Historical references to `src-tauri/` stay as-is since that directory didn't move.

- [ ] **Step 2: Run full unit test suite**

```bash
npm run test:unit
```

Expected: all ~1587 tests pass.

- [ ] **Step 3: Run E2E tests**

```bash
npm run test:e2e
```

Expected: all ~100 E2E tests pass.

- [ ] **Step 4: Run dev server smoke test**

```bash
npm run dev &
sleep 3 && kill %1
```

Expected: Vite starts on port 5173 without errors.

- [ ] **Step 5: Run landing build**

```bash
npm run build:landing
```

Expected: builds into `dist-landing/` successfully.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "refactor: update README for new repo layout"
```

---

## Notes

- **Memory files** (`.claude/projects/.../memory/MEMORY.md`): Contains many `src/` path references. These are historical context — they don't affect builds. Can be updated separately if desired.
- **Docs** (`docs/specs/`, `docs/plans/`, `docs/progress/`): Historical documents reference `src/` and `src-tauri/` paths. These are point-in-time records and don't need updating.
- **landing `node_modules/`**: Delete with `rm -rf landing/node_modules` before or after `git rm`. Not tracked by git.
