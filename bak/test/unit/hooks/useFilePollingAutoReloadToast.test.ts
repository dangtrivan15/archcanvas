import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Feature #522: Show toast notification on auto-reload.
 *
 * Verifies that:
 * 1. When a file is auto-reloaded (isDirty=false, external modification detected),
 *    a toast notification appears: "File updated externally. Reloaded."
 * 2. The toast auto-dismisses after a few seconds (via showToast default timer)
 * 3. The toast does not block user interaction (role="status", aria-live="polite")
 * 4. The FILE_RELOADED_MESSAGE constant is exported
 * 5. No toast is shown on the conflict (isDirty=true) path
 */

describe('Toast notification on auto-reload (Feature #522)', () => {
  let hookSource: string;
  let toastComponentSource: string;

  beforeEach(() => {
    vi.resetModules();
    hookSource = fs.readFileSync(
      path.resolve(__dirname, '../../../src/hooks/useFilePolling.ts'),
      'utf-8',
    );
    toastComponentSource = fs.readFileSync(
      path.resolve(__dirname, '../../../src/components/shared/Toast.tsx'),
      'utf-8',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Step 1: FILE_RELOADED_MESSAGE constant', () => {
    it('defines FILE_RELOADED_MESSAGE constant', () => {
      expect(hookSource).toContain('FILE_RELOADED_MESSAGE');
    });

    it('FILE_RELOADED_MESSAGE has the correct text', () => {
      expect(hookSource).toContain(
        "export const FILE_RELOADED_MESSAGE = 'File updated externally. Reloaded.'",
      );
    });

    it('exports FILE_RELOADED_MESSAGE from the hook module', async () => {
      const mod = await import('@/hooks/useFilePolling');
      expect(mod.FILE_RELOADED_MESSAGE).toBe(
        'File updated externally. Reloaded.',
      );
    });

    it('barrel export includes FILE_RELOADED_MESSAGE', async () => {
      const barrel = await import('@/hooks/index');
      expect(barrel.FILE_RELOADED_MESSAGE).toBe(
        'File updated externally. Reloaded.',
      );
    });
  });

  describe('Step 2: Toast shown after successful auto-reload', () => {
    it('calls showToast with FILE_RELOADED_MESSAGE in auto-reload path', () => {
      // After successful auto-reload (_applyDecodedFile), showToast should be called
      expect(hookSource).toContain('showToast(FILE_RELOADED_MESSAGE)');
    });

    it('showToast is called after _applyDecodedFile (not before)', () => {
      // The toast should appear after the reload completes, not before
      const applyIdx = hookSource.indexOf('_applyDecodedFile');
      const toastIdx = hookSource.indexOf('showToast(FILE_RELOADED_MESSAGE)');
      expect(applyIdx).toBeGreaterThan(-1);
      expect(toastIdx).toBeGreaterThan(-1);
      expect(toastIdx).toBeGreaterThan(applyIdx);
    });

    it('uses useUIStore to access showToast', () => {
      expect(hookSource).toContain("import { useUIStore } from '@/store/uiStore'");
      expect(hookSource).toContain('useUIStore.getState().showToast');
    });

    it('toast is only in the isDirty=false path (not the isDirty=true conflict path)', () => {
      // Split the executeReload function at the isDirty check
      // The auto-reload (isDirty=false) path should have FILE_RELOADED_MESSAGE
      // The conflict (isDirty=true) path should NOT have FILE_RELOADED_MESSAGE
      const executeReloadBody =
        hookSource.split('executeReload')[1] ?? '';

      // Find the !state.isDirty block and the else block
      const isDirtyFalseBlock = executeReloadBody.split('} else {')[0] ?? '';
      const isDirtyTrueBlock = executeReloadBody.split('} else {')[1] ?? '';

      // Toast should be in the isDirty=false path
      expect(isDirtyFalseBlock).toContain('FILE_RELOADED_MESSAGE');
      // Toast should NOT be in the isDirty=true (conflict) path
      expect(isDirtyTrueBlock).not.toContain('FILE_RELOADED_MESSAGE');
    });
  });

  describe('Step 3: Toast auto-dismisses after a few seconds', () => {
    it('showToast uses default durationMs (auto-dismiss)', () => {
      // showToast(message) without explicit duration uses the default (4000ms)
      // The call should NOT pass a custom very-long duration
      const toastCall = hookSource.match(
        /showToast\(FILE_RELOADED_MESSAGE[^)]*\)/,
      );
      expect(toastCall).not.toBeNull();
      // Should use default duration (no second argument, or standard duration)
      const callStr = toastCall![0];
      // Either no second arg, or a reasonable duration
      if (callStr.includes(',')) {
        const durationMatch = callStr.match(/,\s*(\d+)/);
        if (durationMatch) {
          const duration = Number(durationMatch[1]);
          expect(duration).toBeGreaterThan(0);
          expect(duration).toBeLessThanOrEqual(10000);
        }
      }
      // If no second arg, default 4000ms is used (verified in uiStore)
    });

    it('uiStore showToast sets a timer that calls clearToast', async () => {
      const { useUIStore } = await import('@/store/uiStore');
      const state = useUIStore.getState();
      expect(typeof state.showToast).toBe('function');
      expect(typeof state.clearToast).toBe('function');

      // showToast should accept (message, durationMs?) signature
      const storeSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/uiStore.ts'),
        'utf-8',
      );
      expect(storeSource).toContain('setTimeout');
      expect(storeSource).toContain('clearToast');
    });

    it('default toast duration is 4000ms', async () => {
      const storeSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/uiStore.ts'),
        'utf-8',
      );
      // showToast signature: (message, durationMs = 4000)
      expect(storeSource).toContain('durationMs = 4000');
    });
  });

  describe('Step 4: Toast does not block interaction', () => {
    it('Toast component uses role="status" (non-intrusive)', () => {
      expect(toastComponentSource).toContain('role="status"');
    });

    it('Toast component uses aria-live="polite" (non-blocking announcement)', () => {
      expect(toastComponentSource).toContain('aria-live="polite"');
    });

    it('Toast is positioned fixed at bottom center (out of main content area)', () => {
      expect(toastComponentSource).toContain('fixed');
      expect(toastComponentSource).toContain('bottom-4');
    });

    it('Toast has a dismiss button for manual close', () => {
      expect(toastComponentSource).toContain('toast-dismiss');
      expect(toastComponentSource).toContain('Dismiss');
    });

    it('Toast z-index does not block modal dialogs', () => {
      // Toast z-index 200 should be below modal overlays
      expect(toastComponentSource).toContain('z-[200]');
    });
  });

  describe('Step 5: No toast on error fallback path', () => {
    it('no FILE_RELOADED_MESSAGE in the catch block of auto-reload', () => {
      // The catch block that falls back to fileExternallyModified should not show the success toast
      const catchBlock =
        hookSource.match(
          /catch\s*\(reloadErr\)[\s\S]*?fileExternallyModified:\s*true/,
        )?.[0] ?? '';
      expect(catchBlock).not.toContain('FILE_RELOADED_MESSAGE');
    });
  });

  describe('Step 6: Integration with existing toast system', () => {
    it('showToast clears any existing toast before showing new one', async () => {
      const storeSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/uiStore.ts'),
        'utf-8',
      );
      // showToast should clear existing timer before setting new one
      expect(storeSource).toContain('clearTimeout');
    });

    it('showToast sets toastMessage in uiStore state', async () => {
      const { useUIStore } = await import('@/store/uiStore');

      // Call showToast and verify state
      useUIStore.getState().showToast('File updated externally. Reloaded.');
      const state = useUIStore.getState();
      expect(state.toastMessage).toBe('File updated externally. Reloaded.');
      expect(state.toastTimerId).not.toBeNull();

      // Clean up
      useUIStore.getState().clearToast();
    });

    it('clearToast removes the message and timer', async () => {
      const { useUIStore } = await import('@/store/uiStore');

      useUIStore.getState().showToast('Test message');
      expect(useUIStore.getState().toastMessage).toBe('Test message');

      useUIStore.getState().clearToast();
      expect(useUIStore.getState().toastMessage).toBeNull();
      expect(useUIStore.getState().toastTimerId).toBeNull();
    });
  });
});
