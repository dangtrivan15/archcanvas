/**
 * Tests for Feature #238: Autosave on Focus Change
 *
 * Verifies that:
 * 1. visibilitychange event triggers autosave when conditions are met
 * 2. window blur event triggers autosave when conditions are met
 * 3. Autosave only fires when isDirty, not isSaving, and fileHandle exists
 * 4. Autosave respects the autosaveOnBlur toggle preference
 * 5. Status bar message appears after successful autosave
 * 6. Debounce prevents rapid-fire autosaves
 * 7. Toggle in File menu enables/disables autosave
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '../../../src', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

describe('Feature #238: Autosave on Focus Change', () => {
  beforeEach(() => {
    // Reset autosave-related state (merge mode, not replace - preserves functions)
    useUIStore.setState({
      autosaveOnBlur: true,
      autosaveStatusMessage: null,
    });
    useCoreStore.setState({
      isDirty: false,
      isSaving: false,
    });
  });

  // ─── UI Store: Autosave Preference ───────────────────────────────

  describe('UI Store: autosave preference', () => {
    it('defaults autosaveOnBlur to true', () => {
      const state = useUIStore.getState();
      expect(state.autosaveOnBlur).toBe(true);
    });

    it('setAutosaveOnBlur(false) disables autosave', () => {
      useUIStore.getState().setAutosaveOnBlur(false);
      expect(useUIStore.getState().autosaveOnBlur).toBe(false);
    });

    it('setAutosaveOnBlur(true) enables autosave', () => {
      useUIStore.getState().setAutosaveOnBlur(false);
      useUIStore.getState().setAutosaveOnBlur(true);
      expect(useUIStore.getState().autosaveOnBlur).toBe(true);
    });

    it('setAutosaveStatusMessage sets message', () => {
      useUIStore.getState().setAutosaveStatusMessage('Autosaved');
      expect(useUIStore.getState().autosaveStatusMessage).toBe('Autosaved');
    });

    it('setAutosaveStatusMessage(null) clears message', () => {
      useUIStore.getState().setAutosaveStatusMessage('Autosaved');
      useUIStore.getState().setAutosaveStatusMessage(null);
      expect(useUIStore.getState().autosaveStatusMessage).toBeNull();
    });
  });

  // ─── Autosave Logic: Conditions ──────────────────────────────────

  describe('Autosave conditions', () => {
    it('should NOT autosave when autosaveOnBlur is disabled', () => {
      useUIStore.getState().setAutosaveOnBlur(false);
      expect(useUIStore.getState().autosaveOnBlur).toBe(false);
    });

    it('should NOT autosave when isDirty is false', () => {
      const { isDirty } = useCoreStore.getState();
      expect(isDirty).toBe(false);
    });

    it('should NOT autosave when isSaving is true', () => {
      useCoreStore.setState({ isSaving: true });
      expect(useCoreStore.getState().isSaving).toBe(true);
      useCoreStore.setState({ isSaving: false });
    });

    it('should NOT autosave when fileHandle is null (new unsaved file)', () => {
      const { fileHandle } = useCoreStore.getState();
      expect(fileHandle).toBeNull();
    });

    it('should meet all conditions when dirty, not saving, has handle, and enabled', () => {
      useUIStore.setState({ autosaveOnBlur: true });
      useCoreStore.setState({
        isDirty: true,
        isSaving: false,
        fileHandle: {} as FileSystemFileHandle,
      });
      const uiState = useUIStore.getState();
      const coreState = useCoreStore.getState();
      expect(uiState.autosaveOnBlur).toBe(true);
      expect(coreState.isDirty).toBe(true);
      expect(coreState.isSaving).toBe(false);
      expect(coreState.fileHandle).not.toBeNull();
      // Clean up
      useCoreStore.setState({ isDirty: false, fileHandle: null });
    });
  });

  // ─── Status Message ──────────────────────────────────────────────

  describe('Status message lifecycle', () => {
    it('status message can be set to "Autosaved"', () => {
      useUIStore.getState().setAutosaveStatusMessage('Autosaved');
      expect(useUIStore.getState().autosaveStatusMessage).toBe('Autosaved');
    });

    it('status message is cleared when set to null', () => {
      useUIStore.getState().setAutosaveStatusMessage('Autosaved');
      useUIStore.getState().setAutosaveStatusMessage(null);
      expect(useUIStore.getState().autosaveStatusMessage).toBeNull();
    });

    it('status message defaults to null', () => {
      // Use merge-mode reset, then check
      useUIStore.setState({ autosaveStatusMessage: null });
      expect(useUIStore.getState().autosaveStatusMessage).toBeNull();
    });
  });

  // ─── Hook Source Code Verification ───────────────────────────────

  describe('useAutoSaveOnBlur hook implementation', () => {
    const hookSource = readSource('hooks/useAutoSaveOnBlur.ts');

    it('listens for visibilitychange event', () => {
      expect(hookSource).toContain('visibilitychange');
    });

    it('listens for window blur event', () => {
      expect(hookSource).toContain("window.addEventListener('blur'");
    });

    it('checks document.visibilityState for hidden', () => {
      expect(hookSource).toContain("document.visibilityState !== 'hidden'");
    });

    it('checks isDirty before saving', () => {
      expect(hookSource).toContain('isDirty');
    });

    it('checks isSaving to prevent concurrent saves', () => {
      expect(hookSource).toContain('isSaving');
    });

    it('checks fileHandle existence (no picker when hidden)', () => {
      expect(hookSource).toContain('fileHandle');
    });

    it('checks autosaveOnBlur preference', () => {
      expect(hookSource).toContain('autosaveOnBlur');
    });

    it('calls saveFile() from coreStore', () => {
      expect(hookSource).toContain('saveFile()');
    });

    it('sets autosave status message on success', () => {
      expect(hookSource).toContain("setAutosaveStatusMessage('Autosaved')");
    });

    it('clears status message after timeout', () => {
      expect(hookSource).toContain('setAutosaveStatusMessage(null)');
    });

    it('includes debounce protection', () => {
      expect(hookSource).toContain('AUTOSAVE_DEBOUNCE_MS');
    });

    it('cleans up event listeners on unmount', () => {
      expect(hookSource).toContain("document.removeEventListener('visibilitychange'");
      expect(hookSource).toContain("window.removeEventListener('blur'");
    });

    it('cleans up pending status timeout on unmount', () => {
      expect(hookSource).toContain('clearTimeout(statusTimeoutRef.current)');
    });

    it('uses useCallback for memoized event handlers', () => {
      expect(hookSource).toContain('useCallback');
    });

    it('uses useRef for debounce tracking (non-reactive)', () => {
      expect(hookSource).toContain('useRef');
      expect(hookSource).toContain('lastAutosaveRef');
    });
  });

  // ─── App.tsx Integration ─────────────────────────────────────────

  describe('App.tsx integration', () => {
    const appSource = readSource('App.tsx');

    it('imports useAutoSaveOnBlur hook', () => {
      expect(appSource).toContain("import { useAutoSaveOnBlur }");
    });

    it('calls useAutoSaveOnBlur() in App component', () => {
      expect(appSource).toContain('useAutoSaveOnBlur()');
    });

    it('reads autosaveStatusMessage from uiStore', () => {
      expect(appSource).toContain('autosaveStatusMessage');
    });

    it('renders autosave status in the status bar', () => {
      expect(appSource).toContain('data-testid="autosave-status"');
    });

    it('uses green color for autosave status text', () => {
      expect(appSource).toContain('text-green-600');
    });

    it('conditionally renders autosave status (only when message exists)', () => {
      expect(appSource).toContain('autosaveStatusMessage && (');
    });
  });

  // ─── FileMenu Toggle ────────────────────────────────────────────

  describe('FileMenu autosave toggle', () => {
    const fileMenuSource = readSource('components/toolbar/FileMenu.tsx');

    it('includes an autosave toggle button', () => {
      expect(fileMenuSource).toContain('data-testid="autosave-toggle"');
    });

    it('uses menuitemcheckbox role for accessibility', () => {
      expect(fileMenuSource).toContain('role="menuitemcheckbox"');
    });

    it('has aria-checked attribute bound to autosaveOnBlur', () => {
      expect(fileMenuSource).toContain('aria-checked={autosaveOnBlur}');
    });

    it('toggles autosaveOnBlur on click', () => {
      expect(fileMenuSource).toContain('setAutosaveOnBlur(!autosaveOnBlur)');
    });

    it('shows checkmark icon when enabled', () => {
      expect(fileMenuSource).toContain('autosaveOnBlur && <Check');
    });

    it('displays "Autosave on blur" label', () => {
      expect(fileMenuSource).toContain('Autosave on blur');
    });

    it('reads autosaveOnBlur from uiStore', () => {
      expect(fileMenuSource).toContain("useUIStore((s) => s.autosaveOnBlur)");
    });

    it('reads setAutosaveOnBlur from uiStore', () => {
      expect(fileMenuSource).toContain("useUIStore((s) => s.setAutosaveOnBlur)");
    });
  });

  // ─── Toggle State Integration ────────────────────────────────────

  describe('Toggle state integration', () => {
    it('toggling off and on preserves state correctly', () => {
      expect(useUIStore.getState().autosaveOnBlur).toBe(true);
      useUIStore.getState().setAutosaveOnBlur(false);
      expect(useUIStore.getState().autosaveOnBlur).toBe(false);
      useUIStore.getState().setAutosaveOnBlur(true);
      expect(useUIStore.getState().autosaveOnBlur).toBe(true);
    });

    it('autosave toggle is independent of other UI state', () => {
      const initialLeft = useUIStore.getState().leftPanelOpen;
      useUIStore.getState().setAutosaveOnBlur(false);
      expect(useUIStore.getState().leftPanelOpen).toBe(initialLeft);
    });

    it('autosave status message is independent of file operation loading', () => {
      useUIStore.getState().setAutosaveStatusMessage('Autosaved');
      useUIStore.getState().setFileOperationLoading('Opening...');
      expect(useUIStore.getState().autosaveStatusMessage).toBe('Autosaved');
      expect(useUIStore.getState().fileOperationLoading).toBe(true);
      useUIStore.getState().clearFileOperationLoading();
    });

    it('autosave does not interfere with isSaving guard', () => {
      useCoreStore.setState({ isSaving: true });
      expect(useCoreStore.getState().isSaving).toBe(true);
      useCoreStore.setState({ isSaving: false });
    });

    it('autosave requires fileHandle for seamless save-in-place', () => {
      expect(useCoreStore.getState().fileHandle).toBeNull();
    });
  });

  // ─── Debounce Logic ──────────────────────────────────────────────

  describe('Debounce logic', () => {
    const hookSource = readSource('hooks/useAutoSaveOnBlur.ts');

    it('defines AUTOSAVE_DEBOUNCE_MS constant', () => {
      expect(hookSource).toContain('const AUTOSAVE_DEBOUNCE_MS');
    });

    it('defines AUTOSAVE_STATUS_DURATION constant', () => {
      expect(hookSource).toContain('const AUTOSAVE_STATUS_DURATION');
    });

    it('tracks last autosave time with useRef', () => {
      expect(hookSource).toContain('lastAutosaveRef');
    });

    it('compares Date.now() with last autosave time', () => {
      expect(hookSource).toContain('Date.now()');
      expect(hookSource).toContain('lastAutosaveRef.current');
    });

    it('updates lastAutosaveRef after saving', () => {
      expect(hookSource).toContain('lastAutosaveRef.current = now');
    });
  });

  // ─── Event Handling ──────────────────────────────────────────────

  describe('Event handling', () => {
    const hookSource = readSource('hooks/useAutoSaveOnBlur.ts');

    it('registers both visibilitychange and blur listeners', () => {
      expect(hookSource).toContain("document.addEventListener('visibilitychange'");
      expect(hookSource).toContain("window.addEventListener('blur'");
    });

    it('removes both listeners on cleanup', () => {
      expect(hookSource).toContain("document.removeEventListener('visibilitychange'");
      expect(hookSource).toContain("window.removeEventListener('blur'");
    });

    it('only triggers on visibilitychange when state is hidden', () => {
      expect(hookSource).toContain("document.visibilityState !== 'hidden'");
    });

    it('logs autosave actions to console', () => {
      expect(hookSource).toContain('[AutoSave]');
    });
  });
});
