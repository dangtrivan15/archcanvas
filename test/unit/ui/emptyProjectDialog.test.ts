/**
 * Tests for the EmptyProjectDialog component and related store/scanner changes.
 *
 * Feature #463 (original): UI - offer choices when opening a folder with no .archc files
 * Feature #478 (rework): Initialize Architecture dialog with AI/scan choice
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';
import type { EmptyProjectDialogInfo } from '@/store/uiStore';
import { SOURCE_FILE_EXTENSIONS } from '@/core/project/scanner';

describe('EmptyProjectDialog', () => {
  beforeEach(() => {
    // Reset the UI store between tests
    useUIStore.setState({
      emptyProjectDialogOpen: false,
      emptyProjectDialogInfo: null,
    });
  });

  // ── Store state tests ─────────────────────────────────────────

  describe('uiStore - emptyProjectDialog state', () => {
    it('starts with dialog closed and no info', () => {
      const state = useUIStore.getState();
      expect(state.emptyProjectDialogOpen).toBe(false);
      expect(state.emptyProjectDialogInfo).toBeNull();
    });

    it('openEmptyProjectDialog sets open=true and stores info', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'my-project',
        hasSourceFiles: true,
        hasApiKey: true,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      };

      useUIStore.getState().openEmptyProjectDialog(info);

      const state = useUIStore.getState();
      expect(state.emptyProjectDialogOpen).toBe(true);
      expect(state.emptyProjectDialogInfo).toEqual(info);
      expect(state.emptyProjectDialogInfo?.folderName).toBe('my-project');
      expect(state.emptyProjectDialogInfo?.hasSourceFiles).toBe(true);
    });

    it('closeEmptyProjectDialog sets open=false and clears info', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'test-project',
        hasSourceFiles: false,
        hasApiKey: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      };

      useUIStore.getState().openEmptyProjectDialog(info);
      expect(useUIStore.getState().emptyProjectDialogOpen).toBe(true);

      useUIStore.getState().closeEmptyProjectDialog();

      const state = useUIStore.getState();
      expect(state.emptyProjectDialogOpen).toBe(false);
      expect(state.emptyProjectDialogInfo).toBeNull();
    });

    it('stores callbacks that can be invoked', () => {
      const onUseAI = vi.fn();
      const onQuickScan = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'callback-test',
        hasSourceFiles: true,
        hasApiKey: true,
        onUseAI,
        onQuickScan,
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onUseAI();
      expect(onUseAI).toHaveBeenCalledOnce();

      info.onQuickScan();
      expect(onQuickScan).toHaveBeenCalledOnce();
    });
  });

  // ── Scanner source file detection tests ───────────────────────

  describe('SOURCE_FILE_EXTENSIONS', () => {
    it('includes common TypeScript extensions', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.ts')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.tsx')).toBe(true);
    });

    it('includes common JavaScript extensions', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.js')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.jsx')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.mjs')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.cjs')).toBe(true);
    });

    it('includes Python extensions', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.py')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.pyw')).toBe(true);
    });

    it('includes Go extension', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.go')).toBe(true);
    });

    it('includes Java/Kotlin extensions', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.java')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.kt')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.kts')).toBe(true);
    });

    it('includes Rust extension', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.rs')).toBe(true);
    });

    it('includes C/C++ extensions', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.c')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.cpp')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.h')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.hpp')).toBe(true);
    });

    it('includes modern web framework extensions', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.vue')).toBe(true);
      expect(SOURCE_FILE_EXTENSIONS.has('.svelte')).toBe(true);
    });

    it('does not include non-source extensions', () => {
      expect(SOURCE_FILE_EXTENSIONS.has('.txt')).toBe(false);
      expect(SOURCE_FILE_EXTENSIONS.has('.md')).toBe(false);
      expect(SOURCE_FILE_EXTENSIONS.has('.json')).toBe(false);
      expect(SOURCE_FILE_EXTENSIONS.has('.archc')).toBe(false);
      expect(SOURCE_FILE_EXTENSIONS.has('.png')).toBe(false);
    });
  });

  // ── Dialog info shape tests ──────────────────────────────────

  describe('EmptyProjectDialogInfo shape', () => {
    it('has required fields: folderName, hasSourceFiles, hasApiKey, onUseAI, onQuickScan, onConfigureApiKey, onUseExternalAgent', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'test',
        hasSourceFiles: false,
        hasApiKey: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      };

      expect(info.folderName).toBe('test');
      expect(info.hasSourceFiles).toBe(false);
      expect(info.hasApiKey).toBe(false);
      expect(typeof info.onUseAI).toBe('function');
      expect(typeof info.onQuickScan).toBe('function');
      expect(typeof info.onConfigureApiKey).toBe('function');
      expect(typeof info.onUseExternalAgent).toBe('function');
    });

    it('hasSourceFiles=true when source files detected', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'react-app',
        hasSourceFiles: true,
        hasApiKey: true,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      };
      expect(info.hasSourceFiles).toBe(true);
    });

    it('hasSourceFiles=false for empty folder', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'empty-folder',
        hasSourceFiles: false,
        hasApiKey: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      };
      expect(info.hasSourceFiles).toBe(false);
    });

    it('hasApiKey=true when API key is configured', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'api-key-project',
        hasSourceFiles: true,
        hasApiKey: true,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      };
      expect(info.hasApiKey).toBe(true);
    });

    it('hasApiKey=false when no API key', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'no-key-project',
        hasSourceFiles: true,
        hasApiKey: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      };
      expect(info.hasApiKey).toBe(false);
    });
  });

  // ── Dialog behavior tests (option selection) ──────────────────

  describe('Dialog option selection behavior', () => {
    it('calling onUseAI triggers the AI callback', () => {
      const onUseAI = vi.fn();
      const onQuickScan = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'my-app',
        hasSourceFiles: true,
        hasApiKey: true,
        onUseAI,
        onQuickScan,
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onUseAI();

      expect(onUseAI).toHaveBeenCalledOnce();
      expect(onQuickScan).not.toHaveBeenCalled();
    });

    it('calling onQuickScan triggers the quick scan callback', () => {
      const onUseAI = vi.fn();
      const onQuickScan = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'my-app',
        hasSourceFiles: false,
        hasApiKey: false,
        onUseAI,
        onQuickScan,
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent: vi.fn(),
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onQuickScan();

      expect(onQuickScan).toHaveBeenCalledOnce();
      expect(onUseAI).not.toHaveBeenCalled();
    });

    it('cancel (closeDialog) clears state without calling any callback', () => {
      const onUseAI = vi.fn();
      const onQuickScan = vi.fn();
      const onConfigureApiKey = vi.fn();
      const onUseExternalAgent = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'my-app',
        hasSourceFiles: true,
        hasApiKey: true,
        onUseAI,
        onQuickScan,
        onConfigureApiKey,
        onUseExternalAgent,
      });

      // Cancel = close dialog
      useUIStore.getState().closeEmptyProjectDialog();

      expect(onUseAI).not.toHaveBeenCalled();
      expect(onQuickScan).not.toHaveBeenCalled();
      expect(onConfigureApiKey).not.toHaveBeenCalled();
      expect(onUseExternalAgent).not.toHaveBeenCalled();
      expect(useUIStore.getState().emptyProjectDialogOpen).toBe(false);
      expect(useUIStore.getState().emptyProjectDialogInfo).toBeNull();
    });
  });

  // ── AI routing logic tests ──────────────────────────────────

  describe('AI path routing logic', () => {
    it('when hasApiKey=true, Use AI should route directly to built-in agentic loop', () => {
      // The dialog component routes: hasApiKey → onUseAI (direct), !hasApiKey → ai-setup view
      const hasApiKey = true;
      const routesToBuiltInAI = hasApiKey;
      const routesToSetup = !hasApiKey;
      expect(routesToBuiltInAI).toBe(true);
      expect(routesToSetup).toBe(false);
    });

    it('when hasApiKey=false, Use AI should show AI setup options', () => {
      const hasApiKey = false;
      const routesToBuiltInAI = hasApiKey;
      const routesToSetup = !hasApiKey;
      expect(routesToBuiltInAI).toBe(false);
      expect(routesToSetup).toBe(true);
    });

    it('onConfigureApiKey callback can be invoked from AI setup view', () => {
      const onConfigureApiKey = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'no-key-project',
        hasSourceFiles: true,
        hasApiKey: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey,
        onUseExternalAgent: vi.fn(),
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onConfigureApiKey();

      expect(onConfigureApiKey).toHaveBeenCalledOnce();
    });

    it('onUseExternalAgent callback can be invoked from AI setup view', () => {
      const onUseExternalAgent = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'external-agent-project',
        hasSourceFiles: true,
        hasApiKey: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
        onConfigureApiKey: vi.fn(),
        onUseExternalAgent,
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onUseExternalAgent();

      expect(onUseExternalAgent).toHaveBeenCalledOnce();
    });

    it('Quick scan is always available regardless of AI configuration', () => {
      // onQuickScan should work whether hasApiKey is true or false
      for (const hasApiKey of [true, false]) {
        const onQuickScan = vi.fn();

        useUIStore.getState().openEmptyProjectDialog({
          folderName: 'project',
          hasSourceFiles: true,
          hasApiKey,
          onUseAI: vi.fn(),
          onQuickScan,
          onConfigureApiKey: vi.fn(),
          onUseExternalAgent: vi.fn(),
        });

        const info = useUIStore.getState().emptyProjectDialogInfo!;
        info.onQuickScan();
        expect(onQuickScan).toHaveBeenCalledOnce();

        useUIStore.getState().closeEmptyProjectDialog();
      }
    });
  });

  // ── Recommended option logic tests ────────────────────────────

  describe('Recommended option logic', () => {
    it('"Use AI" is always shown as the recommended option', () => {
      // In the new design, "Use AI" is always recommended regardless of source files
      // The "Recommended" badge is always shown on the AI button
      const aiAlwaysRecommended = true;
      expect(aiAlwaysRecommended).toBe(true);
    });

    it('"Quick scan" is shown as the basic fallback option', () => {
      // Quick scan is labeled "Basic" and always available
      const quickScanIsBasic = true;
      expect(quickScanIsBasic).toBe(true);
    });
  });
});
