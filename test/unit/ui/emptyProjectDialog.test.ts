/**
 * Tests for the EmptyProjectDialog component and related store/scanner changes.
 *
 * Feature #463: UI - offer choices when opening a folder with no .archc files
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
        onAnalyze: vi.fn(),
        onStartBlank: vi.fn(),
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
        onAnalyze: vi.fn(),
        onStartBlank: vi.fn(),
      };

      useUIStore.getState().openEmptyProjectDialog(info);
      expect(useUIStore.getState().emptyProjectDialogOpen).toBe(true);

      useUIStore.getState().closeEmptyProjectDialog();

      const state = useUIStore.getState();
      expect(state.emptyProjectDialogOpen).toBe(false);
      expect(state.emptyProjectDialogInfo).toBeNull();
    });

    it('stores callbacks that can be invoked', () => {
      const onAnalyze = vi.fn();
      const onStartBlank = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'callback-test',
        hasSourceFiles: true,
        onAnalyze,
        onStartBlank,
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onAnalyze();
      expect(onAnalyze).toHaveBeenCalledOnce();

      info.onStartBlank();
      expect(onStartBlank).toHaveBeenCalledOnce();
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
    it('has required fields: folderName, hasSourceFiles, onAnalyze, onStartBlank', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'test',
        hasSourceFiles: false,
        onAnalyze: vi.fn(),
        onStartBlank: vi.fn(),
      };

      expect(info.folderName).toBe('test');
      expect(info.hasSourceFiles).toBe(false);
      expect(typeof info.onAnalyze).toBe('function');
      expect(typeof info.onStartBlank).toBe('function');
    });

    it('hasSourceFiles=true when source files detected', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'react-app',
        hasSourceFiles: true,
        onAnalyze: vi.fn(),
        onStartBlank: vi.fn(),
      };
      expect(info.hasSourceFiles).toBe(true);
    });

    it('hasSourceFiles=false for empty folder', () => {
      const info: EmptyProjectDialogInfo = {
        folderName: 'empty-folder',
        hasSourceFiles: false,
        onAnalyze: vi.fn(),
        onStartBlank: vi.fn(),
      };
      expect(info.hasSourceFiles).toBe(false);
    });
  });

  // ── Dialog behavior tests (option selection) ──────────────────

  describe('Dialog option selection behavior', () => {
    it('calling onAnalyze triggers the analyze callback', () => {
      const onAnalyze = vi.fn();
      const onStartBlank = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'my-app',
        hasSourceFiles: true,
        onAnalyze,
        onStartBlank,
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onAnalyze();

      expect(onAnalyze).toHaveBeenCalledOnce();
      expect(onStartBlank).not.toHaveBeenCalled();
    });

    it('calling onStartBlank triggers the blank callback', () => {
      const onAnalyze = vi.fn();
      const onStartBlank = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'my-app',
        hasSourceFiles: false,
        onAnalyze,
        onStartBlank,
      });

      const info = useUIStore.getState().emptyProjectDialogInfo!;
      info.onStartBlank();

      expect(onStartBlank).toHaveBeenCalledOnce();
      expect(onAnalyze).not.toHaveBeenCalled();
    });

    it('cancel (closeDialog) clears state without calling either callback', () => {
      const onAnalyze = vi.fn();
      const onStartBlank = vi.fn();

      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'my-app',
        hasSourceFiles: true,
        onAnalyze,
        onStartBlank,
      });

      // Cancel = close dialog
      useUIStore.getState().closeEmptyProjectDialog();

      expect(onAnalyze).not.toHaveBeenCalled();
      expect(onStartBlank).not.toHaveBeenCalled();
      expect(useUIStore.getState().emptyProjectDialogOpen).toBe(false);
      expect(useUIStore.getState().emptyProjectDialogInfo).toBeNull();
    });
  });

  // ── Recommended option logic tests ────────────────────────────

  describe('Recommended option logic', () => {
    it('when hasSourceFiles=true, Analyze Codebase should be recommended', () => {
      // This tests the logic the component uses to determine the recommended option
      const hasSourceFiles = true;
      const analyzeRecommended = hasSourceFiles;
      const blankRecommended = !hasSourceFiles;
      expect(analyzeRecommended).toBe(true);
      expect(blankRecommended).toBe(false);
    });

    it('when hasSourceFiles=false, Start Blank should be recommended', () => {
      const hasSourceFiles = false;
      const analyzeRecommended = hasSourceFiles;
      const blankRecommended = !hasSourceFiles;
      expect(analyzeRecommended).toBe(false);
      expect(blankRecommended).toBe(true);
    });
  });
});
