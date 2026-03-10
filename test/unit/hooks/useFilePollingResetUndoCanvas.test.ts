import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useHistoryStore } from '@/store/historyStore';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Feature #523: Reset undo history and canvas state on reload.
 *
 * Verifies that when a file is reloaded (auto or manual):
 * 1. Undo history is cleared (previous snapshots no longer match current graph)
 * 2. Ctrl+Z does nothing after reload (canUndo = false)
 * 3. Canvas viewport is restored from the reloaded file data
 * 4. Panel layout is restored from the reloaded file data
 * 5. A fresh "Open file" snapshot is created as the baseline
 */

describe('Reset undo history and canvas state on reload (Feature #523)', () => {
  let useFileStoreRef: typeof import('@/store/fileStore').useFileStore;
let useGraphStoreRef: typeof import('@/store/graphStore').useGraphStore;
  let fileStoreSource: string;
  let historyStoreSource: string;
  let hookSource: string;

  beforeEach(async () => {
    vi.resetModules();
    const fileStoreMod = await import('@/store/fileStore'); const graphStoreMod = await import('@/store/graphStore');
    useFileStoreRef = fileStoreMod.useFileStore; useGraphStoreRef = graphStoreMod.useGraphStore;
    fileStoreSource = fs.readFileSync(
      path.resolve(__dirname, '../../../src/store/fileStore.ts'),
      'utf-8',
    );
    historyStoreSource = fs.readFileSync(
      path.resolve(__dirname, '../../../src/store/historyStore.ts'),
      'utf-8',
    );
    hookSource = fs.readFileSync(
      path.resolve(__dirname, '../../../src/hooks/useFilePolling.ts'),
      'utf-8',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────
  // Step 1: Open a file and make undoable changes, then save
  // ──────────────────────────────────────────
  describe('Step 1: Undo history accumulates during editing', () => {
    it('UndoManager.snapshot() records entries in the history', async () => {
      const { UndoManager } = await import('@/core/history/undoManager');
      const mgr = new UndoManager(100);
      const graph1 = { nodes: [], edges: [], name: 'g1', description: '' };
      const graph2 = { nodes: [], edges: [], name: 'g2', description: '' };

      mgr.snapshot('Initial', graph1);
      mgr.snapshot('Change 1', graph2);

      expect(mgr.historyLength).toBe(2);
      expect(mgr.canUndo).toBe(true);
    });

    it('UndoManager.undo() returns previous graph state', async () => {
      const { UndoManager } = await import('@/core/history/undoManager');
      const mgr = new UndoManager(100);
      const graph1 = { nodes: [], edges: [], name: 'g1', description: '' };
      const graph2 = { nodes: [], edges: [], name: 'g2', description: '' };

      mgr.snapshot('Initial', graph1);
      mgr.snapshot('Change 1', graph2);

      const result = mgr.undo();
      expect(result).toBeDefined();
      expect(result!.name).toBe('g1');
    });

    it('historyStore exposes canUndo and canRedo state', () => {
      const state = useHistoryStore.getState();
      expect(state).toHaveProperty('canUndo');
      expect(state).toHaveProperty('canRedo');
    });
  });

  // ──────────────────────────────────────────
  // Step 2-3: External agent modifies file → file reloads automatically
  // ──────────────────────────────────────────
  describe('Step 2-3: Auto-reload calls _applyDecodedFile', () => {
    it('auto-reload path calls _applyDecodedFile with canvasState', () => {
      const reloadSection = hookSource.match(
        /!state\.isDirty[\s\S]*?_applyDecodedFile\(/,
      );
      expect(reloadSection).not.toBeNull();
      // canvasState is passed as a parameter
      expect(hookSource).toContain('canvasState,');
    });

    it('_applyDecodedFile accepts canvasState parameter', () => {
      expect(fileStoreSource).toMatch(
        /_applyDecodedFile[\s\S]*?canvasState\?/,
      );
    });
  });

  // ──────────────────────────────────────────
  // Step 4: Undo history is cleared (Ctrl+Z does nothing)
  // ──────────────────────────────────────────
  describe('Step 4: Undo history cleared after reload', () => {
    it('_applyDecodedFile delegates undo reset to historyStore', () => {
      // _applyDecodedFile calls useHistoryStore.getState().reset(graph) which clears undo
      expect(fileStoreSource).toContain('useHistoryStore.getState().reset(graph)');
    });

    it('historyStore.reset clears undo and creates a fresh "Open file" snapshot', () => {
      // reset() calls undoManager.clear() then undoManager.snapshot('Open file', graph)
      expect(historyStoreSource).toContain('undoManager.clear()');
      expect(historyStoreSource).toContain("undoManager.snapshot('Open file'");
    });

    it('historyStore.reset sets canUndo to false', () => {
      const resetMatch = historyStoreSource.match(
        /reset[\s\S]*?canUndo:\s*false/,
      );
      expect(resetMatch).not.toBeNull();
    });

    it('historyStore.reset sets canRedo to false', () => {
      const resetMatch = historyStoreSource.match(
        /reset[\s\S]*?canRedo:\s*false/,
      );
      expect(resetMatch).not.toBeNull();
    });

    it('UndoManager.clear() removes all entries and resets index', async () => {
      const { UndoManager } = await import('@/core/history/undoManager');
      const mgr = new UndoManager(100);
      const graph = { nodes: [], edges: [], name: 'test', description: '' };

      // Accumulate history
      mgr.snapshot('Action 1', graph);
      mgr.snapshot('Action 2', graph);
      mgr.snapshot('Action 3', graph);
      expect(mgr.historyLength).toBe(3);
      expect(mgr.canUndo).toBe(true);

      // Clear
      mgr.clear();
      expect(mgr.historyLength).toBe(0);
      expect(mgr.currentHistoryIndex).toBe(-1);
      expect(mgr.canUndo).toBe(false);
      expect(mgr.canRedo).toBe(false);
    });

    it('After clear + single snapshot, canUndo is false (only baseline exists)', async () => {
      const { UndoManager } = await import('@/core/history/undoManager');
      const mgr = new UndoManager(100);
      const graph = { nodes: [], edges: [], name: 'test', description: '' };

      // Simulate _applyDecodedFile behavior
      mgr.clear();
      mgr.snapshot('Open file', graph);

      // Only 1 entry (the baseline) — canUndo should be false
      expect(mgr.historyLength).toBe(1);
      expect(mgr.canUndo).toBe(false);
      expect(mgr.canRedo).toBe(false);
    });

    it('undo() returns undefined when history was cleared and only baseline exists', async () => {
      const { UndoManager } = await import('@/core/history/undoManager');
      const mgr = new UndoManager(100);
      const graph = { nodes: [], edges: [], name: 'test', description: '' };

      // Simulate post-reload state
      mgr.clear();
      mgr.snapshot('Open file', graph);

      const result = mgr.undo();
      expect(result).toBeUndefined();
    });

    it('historyStore.undo() is a no-op when canUndo is false', () => {
      // Verify the undo function checks undoManager.undo() result
      expect(historyStoreSource).toMatch(
        /undo:\s*\(\)\s*=>\s*\{[\s\S]*?undoManager\.undo\(\)/,
      );
      // The result is checked before applying
      expect(historyStoreSource).toMatch(
        /const\s+previousGraph\s*=\s*undoManager\.undo\(\)/,
      );
      expect(historyStoreSource).toMatch(/if\s*\(previousGraph\)/);
    });
  });

  // ──────────────────────────────────────────
  // Step 5: Canvas viewport is restored from the reloaded file
  // ──────────────────────────────────────────
  describe('Step 5: Canvas state restored from reloaded file', () => {
    it('_applyDecodedFile restores viewport from canvasState', () => {
      const viewportRestore = fileStoreSource.match(
        /_applyDecodedFile[\s\S]*?setViewport\(canvasState\.viewport\)/,
      );
      expect(viewportRestore).not.toBeNull();
    });

    it('_applyDecodedFile restores panel layout from canvasState', () => {
      const panelRestore = fileStoreSource.match(
        /_applyDecodedFile[\s\S]*?canvasState\.panelLayout/,
      );
      expect(panelRestore).not.toBeNull();
    });

    it('_applyDecodedFile conditionally opens or closes the right panel', () => {
      const openPanel = fileStoreSource.match(
        /_applyDecodedFile[\s\S]*?canvasState\.panelLayout\.rightPanelOpen[\s\S]*?openRightPanel/,
      );
      expect(openPanel).not.toBeNull();

      const closePanel = fileStoreSource.match(
        /_applyDecodedFile[\s\S]*?closeRightPanel/,
      );
      expect(closePanel).not.toBeNull();
    });

    it('_applyDecodedFile guards canvasState restoration with if(canvasState)', () => {
      // canvasState is optional, so there should be a guard
      const guard = fileStoreSource.match(
        /_applyDecodedFile[\s\S]*?if\s*\(canvasState\)/,
      );
      expect(guard).not.toBeNull();
    });

    it('_applyDecodedFile requests fit view after restoration', () => {
      const fitView = fileStoreSource.match(
        /_applyDecodedFile[\s\S]*?requestFitView\(\)/,
      );
      expect(fitView).not.toBeNull();
    });
  });

  // ──────────────────────────────────────────
  // Integration: Full reload cycle simulation
  // ──────────────────────────────────────────
  describe('Integration: Full reload cycle', () => {
    it('UndoManager correctly simulates full edit → reload cycle', async () => {
      const { UndoManager } = await import('@/core/history/undoManager');
      const mgr = new UndoManager(100);

      // Phase 1: User opens file and makes changes
      const initialGraph = { nodes: [], edges: [], name: 'initial', description: '' };
      const editedGraph1 = { nodes: [], edges: [], name: 'edit1', description: '' };
      const editedGraph2 = { nodes: [], edges: [], name: 'edit2', description: '' };

      mgr.snapshot('Open file', initialGraph);
      mgr.snapshot('Add node', editedGraph1);
      mgr.snapshot('Add edge', editedGraph2);

      expect(mgr.historyLength).toBe(3);
      expect(mgr.canUndo).toBe(true);
      expect(mgr.getDescriptions()).toEqual(['Open file', 'Add node', 'Add edge']);

      // Phase 2: External modification triggers reload (_applyDecodedFile behavior)
      const reloadedGraph = { nodes: [], edges: [], name: 'reloaded', description: '' };
      mgr.clear();
      mgr.snapshot('Open file', reloadedGraph);

      // Phase 3: Verify undo history is reset
      expect(mgr.historyLength).toBe(1);
      expect(mgr.canUndo).toBe(false);
      expect(mgr.canRedo).toBe(false);
      expect(mgr.getDescriptions()).toEqual(['Open file']);

      // Phase 4: Ctrl+Z does nothing
      const undoResult = mgr.undo();
      expect(undoResult).toBeUndefined();
    });

    it('_applyDecodedFile clears isDirty flag after reload', () => {
      const setDirty = fileStoreSource.match(
        /_applyDecodedFile[\s\S]*?useGraphStore\.setState\(\{[\s\S]*?isDirty:\s*false/,
      );
      expect(setDirty).not.toBeNull();
    });

    it('_applyDecodedFile clears fileExternallyModified flag', () => {
      const clearFlag = fileStoreSource.match(
        /_applyDecodedFile[\s\S]*?set\(\{[\s\S]*?fileExternallyModified:\s*false/,
      );
      expect(clearFlag).not.toBeNull();
    });

    it('After reload, new edits create fresh undo history', async () => {
      const { UndoManager } = await import('@/core/history/undoManager');
      const mgr = new UndoManager(100);

      // Simulate reload
      mgr.clear();
      const reloadedGraph = { nodes: [], edges: [], name: 'reloaded', description: '' };
      mgr.snapshot('Open file', reloadedGraph);

      // User makes new changes after reload
      const newEdit = { nodes: [], edges: [], name: 'new-edit', description: '' };
      mgr.snapshot('Add node', newEdit);

      expect(mgr.historyLength).toBe(2);
      expect(mgr.canUndo).toBe(true);

      // Undo goes back to the reloaded baseline
      const undone = mgr.undo();
      expect(undone).toBeDefined();
      expect(undone!.name).toBe('reloaded');
    });
  });
});
