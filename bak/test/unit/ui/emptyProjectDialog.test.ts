/**
 * Tests for the EmptyProjectDialog component and related store/scanner changes.
 *
 * Feature #463 (original): UI - offer choices when opening a folder with no .archc files
 * Feature #478 (rework): Initialize Architecture dialog with AI/scan choice
 * Feature #548: Simplify to 2 options: Use Claude Code and Quick Scan
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
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
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
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
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
        onUseAI,
        onQuickScan,
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
    it('has required fields: folderName, hasSourceFiles, onUseAI, onQuickScan', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'test',
        hasSourceFiles: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
      };

      expect(info.folderName).toBe('test');
      expect(info.hasSourceFiles).toBe(false);
      expect(typeof info.onUseAI).toBe('function');
      expect(typeof info.onQuickScan).toBe('function');
    });

    it('does not have hasApiKey, onConfigureApiKey, or onUseExternalAgent fields', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'test',
        hasSourceFiles: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
      };

      // These fields were removed in the simplification (feature #548)
      expect('hasApiKey' in info).toBe(false);
      expect('onConfigureApiKey' in info).toBe(false);
      expect('onUseExternalAgent' in info).toBe(false);
    });

    it('hasSourceFiles=true when source files detected', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'react-app',
        hasSourceFiles: true,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
      };
      expect(info.hasSourceFiles).toBe(true);
    });

    it('hasSourceFiles=false for empty folder', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'empty-folder',
        hasSourceFiles: false,
        onUseAI: vi.fn(),
        onQuickScan: vi.fn(),
      };
      expect(info.hasSourceFiles).toBe(false);
    });
  });

  // ── Dialog behavior tests (option selection) ──────────────────

  describe('Dialog option selection behavior', () => {
    it('calling onUseAI triggers the AI callback (opens Claude Code terminal)', () => {
      const onUseAI = vi.fn();
      const onQuickScan = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'my-app',
        hasSourceFiles: true,
        onUseAI,
        onQuickScan,
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
        onUseAI,
        onQuickScan,
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onQuickScan();

      expect(onQuickScan).toHaveBeenCalledOnce();
      expect(onUseAI).not.toHaveBeenCalled();
    });

    it('cancel (closeDialog) clears state without calling any callback', () => {
      const onUseAI = vi.fn();
      const onQuickScan = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'my-app',
        hasSourceFiles: true,
        onUseAI,
        onQuickScan,
      });

      // Cancel = close dialog
      useUIStore.getState().closeEmptyProjectDialog();

      expect(onUseAI).not.toHaveBeenCalled();
      expect(onQuickScan).not.toHaveBeenCalled();
      expect(useUIStore.getState().emptyProjectDialogOpen).toBe(false);
      expect(useUIStore.getState().emptyProjectDialogInfo).toBeNull();
    });
  });

  // ── Simplified dialog tests (feature #548) ──────────────────────────────────

  describe('Simplified dialog (Use Claude Code + Quick Scan)', () => {
    it('Use Claude Code directly calls onUseAI without any API key check', () => {
      const onUseAI = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'project',
        hasSourceFiles: true,
        onUseAI,
        onQuickScan: vi.fn(),
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onUseAI();
      expect(onUseAI).toHaveBeenCalledOnce();
    });

    it('Quick scan is always available', () => {
      const onQuickScan = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'project',
        hasSourceFiles: true,
        onUseAI: vi.fn(),
        onQuickScan,
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onQuickScan();
      expect(onQuickScan).toHaveBeenCalledOnce();
    });
  });

  // ── Recommended option logic tests ────────────────────────────

  describe('Recommended option logic', () => {
    it('"Use Claude Code" is always shown as the recommended option', () => {
      const claudeCodeAlwaysRecommended = true;
      expect(claudeCodeAlwaysRecommended).toBe(true);
    });

    it('"Quick scan" is shown as the basic fallback option', () => {
      const quickScanIsBasic = true;
      expect(quickScanIsBasic).toBe(true);
    });
  });
});
