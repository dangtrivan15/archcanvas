import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { useHistoryStore } from '@/store/historyStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

function makeMainYaml() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serializeCanvas({
    project: { name: 'HistoryTest' },
    nodes: [{ id: 'node-a', type: 'compute/service', displayName: 'Node A' }],
  } as any);
}

async function setupStores() {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
  });
  useHistoryStore.getState().clear();

  const fs = new InMemoryFileSystem();
  fs.seed({ '.archcanvas/main.yaml': makeMainYaml() });

  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();

  return fs;
}

describe('historyStore', () => {
  beforeEach(async () => {
    await setupStores();
  });

  describe('pushPatches', () => {
    it('adds an entry to undoStack', () => {
      useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      expect(useHistoryStore.getState().undoStack).toHaveLength(1);
    });

    it('sets canUndo to true after a push', () => {
      expect(useHistoryStore.getState().canUndo).toBe(false);
      useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      expect(useHistoryStore.getState().canUndo).toBe(true);
    });

    it('clears redoStack on new push', () => {
      // Seed a redo entry by doing undo
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'tmp',
        type: 'compute/service',
        displayName: 'Tmp',
        position: { x: 0, y: 0 },
      });
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().redoStack).toHaveLength(1);

      // New push should clear redo
      useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      expect(useHistoryStore.getState().redoStack).toHaveLength(0);
      expect(useHistoryStore.getState().canRedo).toBe(false);
    });

    it('enforces max depth of 50, dropping the oldest', () => {
      for (let i = 0; i < 51; i++) {
        useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      }
      expect(useHistoryStore.getState().undoStack).toHaveLength(50);
    });
  });

  describe('canUndo / canRedo', () => {
    it('canUndo reflects undoStack length', () => {
      expect(useHistoryStore.getState().canUndo).toBe(false);
      useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      expect(useHistoryStore.getState().canUndo).toBe(true);
    });

    it('canRedo reflects redoStack length', () => {
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'node-b',
        type: 'compute/service',
        displayName: 'Node B',
        position: { x: 0, y: 0 },
      });
      expect(useHistoryStore.getState().canRedo).toBe(false);
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().canRedo).toBe(true);
    });
  });

  describe('undo', () => {
    it('CRITICAL: actually mutates fileStore data, does not silently no-op', () => {
      // Add node via graphStore (pushes patches automatically)
      const result = useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'node-b',
        type: 'compute/service',
        displayName: 'Node B',
        position: { x: 10, y: 20 },
      });
      expect(result.ok).toBe(true);

      // Verify node exists in fileStore
      const canvasBefore = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY);
      expect(canvasBefore?.data.nodes?.some((n) => n.id === 'node-b')).toBe(true);

      // Undo
      useHistoryStore.getState().undo();

      // CRITICAL: node must be gone from fileStore
      const canvasAfter = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY);
      expect(canvasAfter?.data.nodes?.some((n) => n.id === 'node-b')).toBe(false);
    });

    it('pops from undoStack and pushes to redoStack', () => {
      useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      expect(useHistoryStore.getState().undoStack).toHaveLength(1);

      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().undoStack).toHaveLength(0);
      expect(useHistoryStore.getState().redoStack).toHaveLength(1);
    });

    it('is a no-op when undoStack is empty', () => {
      expect(useHistoryStore.getState().undoStack).toHaveLength(0);
      // Should not throw
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().undoStack).toHaveLength(0);
      expect(useHistoryStore.getState().redoStack).toHaveLength(0);
    });

    it('updates canUndo and canRedo after undo', () => {
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'node-c',
        type: 'compute/service',
        displayName: 'Node C',
        position: { x: 0, y: 0 },
      });
      expect(useHistoryStore.getState().canUndo).toBe(true);
      expect(useHistoryStore.getState().canRedo).toBe(false);

      useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().canUndo).toBe(false);
      expect(useHistoryStore.getState().canRedo).toBe(true);
    });
  });

  describe('redo', () => {
    it('pops from redoStack and pushes to undoStack', () => {
      useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().redoStack).toHaveLength(1);

      useHistoryStore.getState().redo();
      expect(useHistoryStore.getState().redoStack).toHaveLength(0);
      expect(useHistoryStore.getState().undoStack).toHaveLength(1);
    });

    it('is a no-op when redoStack is empty', () => {
      expect(useHistoryStore.getState().redoStack).toHaveLength(0);
      // Should not throw
      useHistoryStore.getState().redo();
      expect(useHistoryStore.getState().undoStack).toHaveLength(0);
    });

    it('redo after undo restores the added node', () => {
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'node-d',
        type: 'compute/service',
        displayName: 'Node D',
        position: { x: 5, y: 5 },
      });

      // Verify node is present
      expect(
        useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)?.data.nodes?.some((n) => n.id === 'node-d')
      ).toBe(true);

      // Undo: node should disappear
      useHistoryStore.getState().undo();
      expect(
        useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)?.data.nodes?.some((n) => n.id === 'node-d')
      ).toBe(false);

      // Redo: node should come back
      useHistoryStore.getState().redo();
      expect(
        useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)?.data.nodes?.some((n) => n.id === 'node-d')
      ).toBe(true);
    });

    it('updates canUndo and canRedo after redo', () => {
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'node-e',
        type: 'compute/service',
        displayName: 'Node E',
        position: { x: 0, y: 0 },
      });
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().canRedo).toBe(true);

      useHistoryStore.getState().redo();
      expect(useHistoryStore.getState().canRedo).toBe(false);
      expect(useHistoryStore.getState().canUndo).toBe(true);
    });
  });

  describe('multiple undo/redo cycles', () => {
    it('multiple undo/redo cycles work correctly', () => {
      // Add two nodes
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'node-x',
        type: 'compute/service',
        displayName: 'Node X',
        position: { x: 0, y: 0 },
      });
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'node-y',
        type: 'compute/service',
        displayName: 'Node Y',
        position: { x: 10, y: 10 },
      });

      const nodes = () => useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)?.data.nodes ?? [];

      expect(nodes().some((n) => n.id === 'node-x')).toBe(true);
      expect(nodes().some((n) => n.id === 'node-y')).toBe(true);

      // Undo node-y
      useHistoryStore.getState().undo();
      expect(nodes().some((n) => n.id === 'node-y')).toBe(false);
      expect(nodes().some((n) => n.id === 'node-x')).toBe(true);

      // Undo node-x
      useHistoryStore.getState().undo();
      expect(nodes().some((n) => n.id === 'node-x')).toBe(false);

      // Redo node-x
      useHistoryStore.getState().redo();
      expect(nodes().some((n) => n.id === 'node-x')).toBe(true);
      expect(nodes().some((n) => n.id === 'node-y')).toBe(false);

      // Redo node-y
      useHistoryStore.getState().redo();
      expect(nodes().some((n) => n.id === 'node-x')).toBe(true);
      expect(nodes().some((n) => n.id === 'node-y')).toBe(true);
    });
  });

  describe('batch operations', () => {
    it('beginBatch + commitBatch merges multiple pushes into one undo entry', () => {
      const hs = useHistoryStore.getState();
      hs.beginBatch();

      // Add two nodes — each goes through graphStore which calls pushPatches
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'batch-a',
        type: 'compute/service',
        displayName: 'Batch A',
        position: { x: 0, y: 0 },
      });
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'batch-b',
        type: 'compute/service',
        displayName: 'Batch B',
        position: { x: 10, y: 10 },
      });

      // During batch, nothing should be on the undo stack yet
      expect(useHistoryStore.getState().undoStack).toHaveLength(0);

      hs.commitBatch();

      // After commit, exactly one entry on the stack
      expect(useHistoryStore.getState().undoStack).toHaveLength(1);
    });

    it('single undo after batch reverses all batched operations', () => {
      const hs = useHistoryStore.getState();
      const nodes = () => useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)?.data.nodes ?? [];

      hs.beginBatch();

      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'batch-x',
        type: 'compute/service',
        displayName: 'Batch X',
        position: { x: 0, y: 0 },
      });
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'batch-y',
        type: 'compute/service',
        displayName: 'Batch Y',
        position: { x: 10, y: 10 },
      });

      hs.commitBatch();

      // Both nodes exist
      expect(nodes().some((n) => n.id === 'batch-x')).toBe(true);
      expect(nodes().some((n) => n.id === 'batch-y')).toBe(true);

      // Single undo removes both
      hs.undo();

      expect(nodes().some((n) => n.id === 'batch-x')).toBe(false);
      expect(nodes().some((n) => n.id === 'batch-y')).toBe(false);
    });

    it('redo after batch undo restores all batched operations', () => {
      const hs = useHistoryStore.getState();
      const nodes = () => useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)?.data.nodes ?? [];

      hs.beginBatch();

      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'redo-a',
        type: 'compute/service',
        displayName: 'Redo A',
        position: { x: 0, y: 0 },
      });
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'redo-b',
        type: 'compute/service',
        displayName: 'Redo B',
        position: { x: 10, y: 10 },
      });

      hs.commitBatch();
      hs.undo();

      // Both gone
      expect(nodes().some((n) => n.id === 'redo-a')).toBe(false);
      expect(nodes().some((n) => n.id === 'redo-b')).toBe(false);

      // Redo brings both back
      hs.redo();

      expect(nodes().some((n) => n.id === 'redo-a')).toBe(true);
      expect(nodes().some((n) => n.id === 'redo-b')).toBe(true);
    });

    it('commitBatch with empty buffer is a no-op', () => {
      const hs = useHistoryStore.getState();
      hs.beginBatch();
      hs.commitBatch();

      expect(useHistoryStore.getState().undoStack).toHaveLength(0);
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });

    it('commitBatch with single entry does not require merging', () => {
      const hs = useHistoryStore.getState();
      hs.beginBatch();

      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'solo',
        type: 'compute/service',
        displayName: 'Solo',
        position: { x: 0, y: 0 },
      });

      hs.commitBatch();

      expect(useHistoryStore.getState().undoStack).toHaveLength(1);

      // Undo should work correctly
      hs.undo();
      const nodes = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)?.data.nodes ?? [];
      expect(nodes.some((n) => n.id === 'solo')).toBe(false);
    });
  });

  describe('clear', () => {
    it('empties both stacks and resets canUndo/canRedo', () => {
      useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      useHistoryStore.getState().pushPatches(ROOT_CANVAS_KEY, [], []);
      // Trigger undo to populate redoStack
      useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().undoStack.length).toBeGreaterThan(0);
      expect(useHistoryStore.getState().redoStack.length).toBeGreaterThan(0);

      useHistoryStore.getState().clear();

      expect(useHistoryStore.getState().undoStack).toHaveLength(0);
      expect(useHistoryStore.getState().redoStack).toHaveLength(0);
      expect(useHistoryStore.getState().canUndo).toBe(false);
      expect(useHistoryStore.getState().canRedo).toBe(false);
    });
  });

  describe('dirty flag tracking (save-point)', () => {
    const isDirty = () => useFileStore.getState().dirtyCanvases.size > 0;

    it('undo back to initial state clears dirty flag', () => {
      // Fresh project — not dirty
      expect(isDirty()).toBe(false);

      // Add a node (marks dirty via updateCanvasData)
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'dirty-a',
        type: 'compute/service',
        displayName: 'Dirty A',
        position: { x: 0, y: 0 },
      });
      expect(isDirty()).toBe(true);

      // Undo — back to initial (save-point version 0)
      useHistoryStore.getState().undo();
      expect(isDirty()).toBe(false);
    });

    it('undo then redo re-marks dirty', () => {
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'dirty-b',
        type: 'compute/service',
        displayName: 'Dirty B',
        position: { x: 0, y: 0 },
      });

      useHistoryStore.getState().undo();
      expect(isDirty()).toBe(false);

      // Redo — version moves away from save point again
      useHistoryStore.getState().redo();
      expect(isDirty()).toBe(true);
    });

    it('save then edit then undo clears dirty flag', async () => {
      // Add node and save
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'dirty-c',
        type: 'compute/service',
        displayName: 'Dirty C',
        position: { x: 0, y: 0 },
      });

      const fs = useFileStore.getState().fs!;
      await useFileStore.getState().saveCanvas(fs, ROOT_CANVAS_KEY);
      expect(isDirty()).toBe(false);

      // New edit after save
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'dirty-d',
        type: 'compute/service',
        displayName: 'Dirty D',
        position: { x: 0, y: 0 },
      });
      expect(isDirty()).toBe(true);

      // Undo the post-save edit — back to save point
      useHistoryStore.getState().undo();
      expect(isDirty()).toBe(false);
    });

    it('multiple edits require matching number of undos to reach save point', () => {
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'dirty-e',
        type: 'compute/service',
        displayName: 'Dirty E',
        position: { x: 0, y: 0 },
      });
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'dirty-f',
        type: 'compute/service',
        displayName: 'Dirty F',
        position: { x: 10, y: 10 },
      });

      // One undo — still dirty (one edit remains past save point)
      useHistoryStore.getState().undo();
      expect(isDirty()).toBe(true);

      // Second undo — clean
      useHistoryStore.getState().undo();
      expect(isDirty()).toBe(false);
    });

    it('undo past save point marks dirty again', async () => {
      // Add node and save (save point at version 1)
      useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
        id: 'dirty-g',
        type: 'compute/service',
        displayName: 'Dirty G',
        position: { x: 0, y: 0 },
      });
      const fs = useFileStore.getState().fs!;
      await useFileStore.getState().saveCanvas(fs, ROOT_CANVAS_KEY);
      expect(isDirty()).toBe(false);

      // Undo past the save point — data diverges from saved state
      useHistoryStore.getState().undo();
      expect(isDirty()).toBe(true);

      // Redo back to save point — clean again
      useHistoryStore.getState().redo();
      expect(isDirty()).toBe(false);
    });
  });
});
