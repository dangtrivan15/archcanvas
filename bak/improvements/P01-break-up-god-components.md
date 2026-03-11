# P01: Break Up God Components

**Parallel safety**: DEPENDS ON P02 (State Restructuring) completing first.
App.tsx references coreStore heavily — restructuring stores first avoids rewriting App.tsx twice.

**Also note**: P07 (Decouple Canvas) handles Canvas.tsx separately and CAN run in parallel
with this proposal since P01 focuses on App.tsx and dialogs, P07 focuses on Canvas.tsx internals.

---

## Problem

### App.tsx — 432 lines, 13+ inline dialogs

`src/App.tsx` is the god component that directly renders and coordinates:

**Dialogs rendered inline (each with its own open/close state):**
1. DeleteConfirmationDialog
2. ConnectionTypeDialog
3. UnsavedChangesDialog
4. ErrorDialog
5. IntegrityWarningDialog
6. ConflictDialog
7. EmptyProjectDialog
8. AnalysisProgressDialog
9. ExternalAgentDialog
10. ShortcutsHelpPanel
11. ShortcutSettingsPanel
12. SettingsDialog
13. TemplatePicker / TemplateGallery

**Layout components:**
- OfflineBanner
- Toolbar
- Left panel (NodeDefBrowser) with resize handles
- Right panel (NodeDetailPanel / EdgeDetailPanel) with resize handles
- Canvas (center)
- CommandPalette, QuickSearchOverlay
- LoadingOverlay, Toast

**Current pattern (bad):**
```tsx
// App.tsx lines 217-429 — every dialog is hardcoded
{uiStore.deleteDialogOpen && <DeleteConfirmationDialog ... />}
{uiStore.connectionDialogOpen && <ConnectionTypeDialog ... />}
{uiStore.unsavedDialogOpen && <UnsavedChangesDialog ... />}
// ... 10 more ...
```

**Problems:**
- Adding a new dialog = modify App.tsx
- Every dialog's open/close state is a separate boolean in uiStore
- Hard to test dialog flows in isolation
- No way to open dialogs from outside React components (e.g., from store actions)

### uiStore.ts — 833 lines of boolean flags

`src/store/uiStore.ts` has individual boolean flags for each dialog:
```typescript
deleteDialogOpen: boolean;
connectionDialogOpen: boolean;
unsavedDialogOpen: boolean;
errorDialogOpen: boolean;
// ... etc
```

Plus individual setter functions for each flag.

---

## Proposed Solution

### A. Dialog Registry Pattern

Create a dialog registry where dialogs register themselves:

**New file structure:**
```
src/dialogs/
  index.ts              -- Public API: openDialog(), closeDialog()
  registry.ts           -- Dialog component registry
  DialogHost.tsx         -- Single component that renders active dialogs
  types.ts              -- DialogConfig, DialogProps types
  dialogs/
    DeleteConfirmation.tsx
    ConnectionType.tsx
    UnsavedChanges.tsx
    Error.tsx
    IntegrityWarning.tsx
    Conflict.tsx
    EmptyProject.tsx
    AnalysisProgress.tsx
    ExternalAgent.tsx
    ShortcutsHelp.tsx
    ShortcutSettings.tsx
    Settings.tsx
    TemplatePicker.tsx
```

**Registry design:**
```typescript
// src/dialogs/registry.ts
interface DialogConfig {
  id: string;
  component: React.ComponentType<DialogProps>;
  // Optional: default props, z-index priority, dismissable, etc.
}

const dialogRegistry = new Map<string, DialogConfig>();

export function registerDialog(config: DialogConfig): void {
  dialogRegistry.set(config.id, config);
}

export function getDialog(id: string): DialogConfig | undefined {
  return dialogRegistry.get(id);
}
```

**Dialog host (replaces all inline dialogs in App.tsx):**
```typescript
// src/dialogs/DialogHost.tsx
export function DialogHost() {
  const openDialogs = useUIStore(s => s.openDialogs); // Set<string>
  const dialogProps = useUIStore(s => s.dialogProps);  // Map<string, any>

  return (
    <>
      {Array.from(openDialogs).map(id => {
        const config = getDialog(id);
        if (!config) return null;
        const Component = config.component;
        return <Component key={id} {...dialogProps.get(id)} />;
      })}
    </>
  );
}
```

**Opening a dialog from anywhere:**
```typescript
// From a component:
openDialog('delete-confirmation', { nodeId: '...' });

// From a store action:
useUIStore.getState().openDialog('delete-confirmation', { nodeId: '...' });
```

### B. Slim Down App.tsx

After extracting dialogs, App.tsx becomes:

```tsx
// src/App.tsx — target: ~100-150 lines
function App() {
  useAppInitialization();   // Extract init logic to hook
  useKeyboardShortcuts();   // Already exists

  return (
    <ThemeProvider>
      <FocusZoneProvider>
        <AppLayout>
          <Toolbar />
          <LeftPanel />
          <Canvas />
          <RightPanel />
        </AppLayout>
        <DialogHost />      {/* Single component for ALL dialogs */}
        <CommandPalette />
        <QuickSearchOverlay />
        <Toast />
      </FocusZoneProvider>
    </ThemeProvider>
  );
}
```

### C. Extract App Initialization

Move the useEffect initialization chain from App.tsx into a dedicated hook:

```typescript
// src/hooks/useAppInitialization.ts
export function useAppInitialization() {
  const { initialize, initialized } = useCoreStore();

  // Initialize engines
  useEffect(() => { initialize(); }, [initialize]);

  // Handle URL-based file loading
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(window.location.search);
    const loadFile = params.get('load');
    if (loadFile) { /* ... */ }
  }, [initialized]);

  // Hide splash screen
  useEffect(() => {
    if (initialized) hideSplashScreen();
  }, [initialized]);

  return { initialized };
}
```

### D. Extract Layout Component

```typescript
// src/components/layout/AppLayout.tsx
// Handles left/right panel sizing, drag handles, responsive breakpoints
export function AppLayout({ children }: { children: React.ReactNode }) {
  // Panel resize logic currently in App.tsx
  // Responsive layout hooks
  // Drag handle components
}
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/App.tsx` | Gut to ~150 lines, delegate to DialogHost + AppLayout |
| `src/store/uiStore.ts` | Replace 13 boolean flags with `openDialogs: Set<string>` + `dialogProps: Map` |
| `src/components/shared/DeleteConfirmationDialog.tsx` | Move to `src/dialogs/dialogs/` + add registration |
| `src/components/shared/ConnectionTypeDialog.tsx` | Move to `src/dialogs/dialogs/` |
| `src/components/shared/UnsavedChangesDialog.tsx` | Move to `src/dialogs/dialogs/` |
| `src/components/shared/ErrorDialog.tsx` | Move to `src/dialogs/dialogs/` |
| (all other dialog components) | Move + register |

**New files:**
- `src/dialogs/index.ts`
- `src/dialogs/registry.ts`
- `src/dialogs/DialogHost.tsx`
- `src/dialogs/types.ts`
- `src/hooks/useAppInitialization.ts`
- `src/components/layout/AppLayout.tsx`

---

## Acceptance Criteria

1. App.tsx is under 150 lines
2. No dialog components are directly imported/rendered in App.tsx
3. Adding a new dialog requires ZERO changes to App.tsx or uiStore.ts
4. All existing dialog open/close behaviors work identically
5. `npm run test` passes
6. `npm run build` succeeds
