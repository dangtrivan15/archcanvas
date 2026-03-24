# Tauri Multi-Window + Minimal Native Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `window.open()` with Tauri window creation API for desktop, and configure minimal native macOS menu.

**Architecture:** Detect Tauri in `fileStore.open()` and use `@tauri-apps/api/webviewWindow` to create new windows. Configure minimal native menu in Rust (App, Edit, Window submenus only) so clipboard shortcuts work in native text inputs without duplicating the React MenuBar.

**Tech Stack:** Tauri 2.0, Rust, @tauri-apps/api

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `src-tauri/src/lib.rs` | Tauri app setup | Add minimal native menu |
| `src-web/store/fileStore.ts` | Project state management | Tauri window creation in `open()` and `openRecent()` |
| `src-tauri/tauri.conf.json` | Tauri configuration | Verify multiwindow support (should work by default) |

---

### Task 1: Add minimal native macOS menu in Rust

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add menu imports**

At the top of `src-tauri/src/lib.rs`, add:

```rust
use tauri::menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem};
```

- [ ] **Step 2: Build minimal menu in setup closure**

In the `.setup()` closure (after line 106, after the updater plugin registration), add:

```rust
            // Minimal native macOS menu — project actions stay in React MenuBar
            let app_menu = SubmenuBuilder::new(app, "ArchCanvas")
                .about(None)
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .zoom()
                .separator()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

Note: If the Tauri menu API differs from what's shown (method names, builder patterns), consult the Tauri 2.0 docs. The builder pattern and `PredefinedMenuItem` approach are standard for Tauri 2.0 but exact method names may vary.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add minimal native macOS menu (App, Edit, Window)"
```

---

### Task 2: Replace window.open() with Tauri WebviewWindow

**Files:**
- Modify: `src-web/store/fileStore.ts`

- [ ] **Step 1: Update open() to use Tauri window creation**

In `src-web/store/fileStore.ts`, replace the `open()` method's new-tab block (lines 353-357):

```ts
    // One project per tab: if a project is already loaded, open a new tab instead
    if (get().fs !== null && typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(`${window.location.origin}${window.location.pathname}?action=open`, '_blank');
      return;
    }
```

With:

```ts
    // One project per tab/window: if a project is already loaded, open a new tab/window
    if (get().fs !== null && typeof window !== 'undefined') {
      if ('__TAURI_INTERNALS__' in window) {
        // Desktop: create a new Tauri window
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        new WebviewWindow(`project-${Date.now()}`, {
          url: 'index.html?action=open',
          title: 'ArchCanvas',
          width: 1280,
          height: 800,
        });
      } else if (typeof window.open === 'function') {
        // Web: open a new browser tab
        window.open(`${window.location.origin}${window.location.pathname}?action=open`, '_blank');
      }
      return;
    }
```

- [ ] **Step 2: Update openRecent() Tauri branch**

In the `openRecent()` method, replace the Tauri fallback at the bottom:

```ts
    // Tauri: path is a filesystem path — open in new window (Task 3 will handle this)
    // For now, fall back to window.open which Task 3 will replace
    window.open(
      `${window.location.origin}${window.location.pathname}?recent=${encodeURIComponent(path)}`,
      '_blank',
    );
```

With:

```ts
    // Tauri: path is a filesystem path — open in new window
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      new WebviewWindow(`project-${Date.now()}`, {
        url: `index.html?action=open`,
        title: 'ArchCanvas',
        width: 1280,
        height: 800,
      });
      // The new window will show ProjectGate → directory picker.
      // TODO: In the future, pass the path so the new window auto-opens it.
    } catch (err) {
      console.error('[fileStore] Failed to create Tauri window:', err);
    }
```

Note: Tauri recents with auto-path-opening requires deeper integration (passing the path to the new window's ProjectGate). For now, the new window shows the picker. This can be enhanced later.

- [ ] **Step 3: Run unit tests to verify no regression**

Run: `npm test -- --run test/store/fileStore-open.test.ts test/unit/store/fileStore.test.ts`
Expected: All PASS (Tauri code paths are behind `__TAURI_INTERNALS__` check, won't execute in test)

- [ ] **Step 4: Commit**

```bash
git add src-web/store/fileStore.ts
git commit -m "feat: use Tauri WebviewWindow for multi-window on desktop"
```

---

### Task 3: Verify and test

- [ ] **Step 1: Run full unit test suite**

Run: `npm test -- --run`
Expected: All PASS

- [ ] **Step 2: Run E2E tests**

Run: `npm run test:e2e-no-bridge`
Expected: All PASS

- [ ] **Step 3: Verify Tauri builds (if Tauri toolchain available)**

Run: `cd src-tauri && cargo check`
Expected: Compiles

Note: Full Tauri build (`cargo tauri build`) and runtime testing requires the Tauri development environment. The Rust compilation check verifies the menu code is syntactically correct. Runtime testing of multi-window behavior should be done manually.
