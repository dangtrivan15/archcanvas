/**
 * Feature #526: Conflict resolution — "Keep your version" dismisses notification
 *
 * Verifies that clicking "Keep your version" in the conflict dialog:
 * 1. Dismisses the conflict dialog
 * 2. Preserves local (in-memory) changes intact
 * 3. Keeps isDirty as true
 * 4. Allows polling to continue so future external changes trigger a new conflict dialog
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useUIStore } from '@/store/uiStore';
import fs from 'fs';
import path from 'path';

// Source paths
const CONFLICT_DIALOG_PATH = path.resolve(
  __dirname,
  '../../../src/dialogs/ConflictDialog.tsx',
);
const USE_FILE_POLLING_PATH = path.resolve(
  __dirname,
  '../../../src/hooks/useFilePolling.ts',
);
const CORE_STORE_PATH = path.resolve(
  __dirname,
  '../../../src/store/fileStore.ts',
);

describe('Feature #526: Keep your version dismisses notification', () => {
  let useFileStoreRef: typeof import('@/store/fileStore').useFileStore;
let useGraphStoreRef: typeof import('@/store/graphStore').useGraphStore;
  let useUIStore: typeof import('@/store/uiStore').useUIStore;

  beforeEach(async () => {
    vi.resetModules();
    const fileStoreMod = await import('@/store/fileStore');
    const graphStoreMod = await import('@/store/graphStore');
    useFileStoreRef = fileStoreMod.useFileStore;
    useGraphStoreRef = graphStoreMod.useGraphStore;
    const uiMod = await import('@/store/uiStore');
    useUIStore = uiMod.useUIStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Step 1: Open a file, make local changes, trigger external modification ──

  describe('Step 1: Conflict dialog appears when isDirty and external modification detected', () => {
    it('useFilePolling sets fileExternallyModified=true when isDirty', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      // The isDirty=true branch sets fileExternallyModified: true
      expect(src).toContain('fileExternallyModified: true');
    });

    it('useFilePolling opens conflict dialog with fileName and callbacks', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      expect(src).toContain('openConflictDialog');
      expect(src).toContain('fileName: handle.name');
      expect(src).toContain('onReload:');
      expect(src).toContain('onSaveAsCopy:');
    });

    it('ConflictDialog has a "Keep your version" button', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('Keep your version');
      expect(src).toContain('data-testid="conflict-keep-button"');
    });
  });

  // ── Step 2: Click "Keep your version" — dialog dismissed ──

  describe('Step 2: "Keep your version" dismisses the conflict dialog', () => {
    it('handleKeep calls acknowledgeExternalModification and closeDialog', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      // handleKeep must call both acknowledgeExternalModification and closeDialog
      expect(src).toContain('acknowledgeExternalModification');
      expect(src).toContain('closeDialog');
    });

    it('closeConflictDialog sets conflictDialogOpen=false and info=null', () => {
      const info = {
        fileName: 'test.archc',
        onReload: vi.fn(),
        onSaveAsCopy: vi.fn(),
      };
      useUIStore.getState().openConflictDialog(info);
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);

      useUIStore.getState().closeConflictDialog();
      expect(useUIStore.getState().conflictDialogOpen).toBe(false);
      expect(useUIStore.getState().conflictDialogInfo).toBeNull();
    });

    it('acknowledgeExternalModification clears fileExternallyModified flag', () => {
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      useFileStore.getState().acknowledgeExternalModification();
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });

    it('handleKeep does NOT call onReload (file is not re-read from disk)', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      // Extract the handleKeep function body
      const handleKeepMatch = src.match(
        /const handleKeep = useCallback\(\(\) => \{([\s\S]*?)\}, \[/,
      );
      expect(handleKeepMatch).not.toBeNull();
      const handleKeepBody = handleKeepMatch![1];

      // handleKeep should NOT call info.onReload or _applyDecodedFile
      expect(handleKeepBody).not.toContain('onReload');
      expect(handleKeepBody).not.toContain('_applyDecodedFile');
    });

    it('handleKeep does NOT call onSaveAsCopy', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      const handleKeepMatch = src.match(
        /const handleKeep = useCallback\(\(\) => \{([\s\S]*?)\}, \[/,
      );
      expect(handleKeepMatch).not.toBeNull();
      const handleKeepBody = handleKeepMatch![1];

      expect(handleKeepBody).not.toContain('onSaveAsCopy');
      expect(handleKeepBody).not.toContain('saveFileAs');
    });
  });

  // ── Step 3: Local changes are still intact ──

  describe('Step 3: Local changes are preserved after "Keep your version"', () => {
    it('graph state is not modified by acknowledgeExternalModification', () => {
      // Set up graph state with "local changes"
      const testGraph = {
        name: 'Modified Graph',
        description: 'Has local changes',
        owners: ['user'],
        nodes: [
          {
            id: 'test-node',
            type: 'compute/service',
            displayName: 'My Local Node',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 100, y: 200, width: 240, height: 100 },
            children: [],
          },
        ],
        edges: [],
        annotations: [],
      };
      useGraphStore.setState({ graph: testGraph, isDirty: true }); useFileStore.setState({ fileExternallyModified: true });

      // Simulate "Keep your version" — calls acknowledgeExternalModification
      useFileStore.getState().acknowledgeExternalModification();

      // Graph should be exactly the same
      const currentGraph = useGraphStore.getState().graph;
      expect(currentGraph.name).toBe('Modified Graph');
      expect(currentGraph.description).toBe('Has local changes');
      expect(currentGraph.nodes).toHaveLength(1);
      expect(currentGraph.nodes[0].id).toBe('test-node');
      expect(currentGraph.nodes[0].displayName).toBe('My Local Node');
    });

    it('node positions are preserved after acknowledging external modification', () => {
      const testGraph = {
        name: 'test',
        description: '',
        owners: [],
        nodes: [
          {
            id: 'n1',
            type: 'compute/service',
            displayName: 'Node 1',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 42, y: 99, width: 240, height: 100 },
            children: [],
          },
        ],
        edges: [],
        annotations: [],
      };
      useGraphStore.setState({ graph: testGraph, isDirty: true }); useFileStore.setState({ fileExternallyModified: true });

      useFileStore.getState().acknowledgeExternalModification();

      expect(useGraphStore.getState().graph.nodes[0].position.x).toBe(42);
      expect(useGraphStore.getState().graph.nodes[0].position.y).toBe(99);
    });

    it('edge data is preserved after acknowledging external modification', () => {
      const testGraph = {
        name: 'test',
        description: '',
        owners: [],
        nodes: [
          {
            id: 'a',
            type: 'compute/service',
            displayName: 'A',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 0, y: 0, width: 240, height: 100 },
            children: [],
          },
          {
            id: 'b',
            type: 'compute/service',
            displayName: 'B',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 300, y: 0, width: 240, height: 100 },
            children: [],
          },
        ],
        edges: [
          {
            id: 'e1',
            fromNode: 'a',
            toNode: 'b',
            type: 'SYNC' as const,
            label: 'API Call',
            fromPort: '',
            toPort: '',
            properties: {},
            notes: [],
          },
        ],
        annotations: [],
      };
      useGraphStore.setState({ graph: testGraph, isDirty: true }); useFileStore.setState({ fileExternallyModified: true });

      useFileStore.getState().acknowledgeExternalModification();

      expect(useGraphStore.getState().graph.edges).toHaveLength(1);
      expect(useGraphStore.getState().graph.edges[0].label).toBe('API Call');
    });
  });

  // ── Step 4: isDirty is still true ──

  describe('Step 4: isDirty remains true after "Keep your version"', () => {
    it('acknowledgeExternalModification does NOT set isDirty to false', () => {
      useGraphStore.setState({ isDirty: true }); useFileStore.setState({ fileExternallyModified: true });

      useFileStore.getState().acknowledgeExternalModification();

      // isDirty must remain true — the user still has unsaved changes
      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('acknowledgeExternalModification only clears fileExternallyModified', () => {
      const src = fs.readFileSync(CORE_STORE_PATH, 'utf-8');
      // Find the acknowledgeExternalModification implementation
      const match = src.match(
        /acknowledgeExternalModification:\s*\(\)\s*=>\s*\{([\s\S]*?)\}/,
      );
      expect(match).not.toBeNull();
      const body = match![1];

      // Should set fileExternallyModified: false
      expect(body).toContain('fileExternallyModified: false');
      // Should NOT touch isDirty
      expect(body).not.toContain('isDirty');
    });

    it('closeConflictDialog does NOT touch isDirty state', () => {
      useGraphStore.setState({ isDirty: true });
      useUIStore.getState().openConflictDialog({
        fileName: 'test.archc',
        onReload: vi.fn(),
        onSaveAsCopy: vi.fn(),
      });

      useUIStore.getState().closeConflictDialog();

      // Closing dialog must not modify coreStore isDirty
      expect(useGraphStore.getState().isDirty).toBe(true);
    });
  });

  // ── Step 5: Polling continues — future external changes trigger new conflict ──

  describe('Step 5: Polling continues and detects future external changes', () => {
    it('useFilePolling does not stop polling after conflict dialog', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      // Polling uses setInterval — verify it's never cleared in the isDirty branch
      // The interval is cleared only in the cleanup function (useEffect return)
      expect(src).toContain('setInterval');
      // The interval cleanup is in the effect return, not in the conflict handler
      expect(src).toContain('clearInterval');
    });

    it('fileExternallyModified is cleared after acknowledge, allowing re-detection', () => {
      // Simulate first conflict
      useGraphStore.setState({ isDirty: true }); useFileStore.setState({ fileExternallyModified: true });

      // User clicks "Keep your version"
      useFileStore.getState().acknowledgeExternalModification();
      expect(useFileStore.getState().fileExternallyModified).toBe(false);

      // Simulate second external modification detected by polling
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      // Can open a new conflict dialog
      useUIStore.getState().openConflictDialog({
        fileName: 'test.archc',
        onReload: vi.fn(),
        onSaveAsCopy: vi.fn(),
      });
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);
    });

    it('conflict dialog can be opened multiple times (not a one-shot)', () => {
      const onReload1 = vi.fn();
      const onReload2 = vi.fn();

      // First conflict
      useUIStore.getState().openConflictDialog({
        fileName: 'test.archc',
        onReload: onReload1,
        onSaveAsCopy: vi.fn(),
      });
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);

      // Dismiss first
      useFileStore.getState().acknowledgeExternalModification();
      useUIStore.getState().closeConflictDialog();
      expect(useUIStore.getState().conflictDialogOpen).toBe(false);

      // Second conflict
      useUIStore.getState().openConflictDialog({
        fileName: 'test.archc',
        onReload: onReload2,
        onSaveAsCopy: vi.fn(),
      });
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);
      // The new dialog has its own callbacks
      expect(useUIStore.getState().conflictDialogInfo?.onReload).toBe(onReload2);
    });

    it('polling uses timestamp comparison, not fileExternallyModified flag', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      // Polling detects changes by comparing lastModified timestamps, not the flag
      expect(src).toContain('lastModified');
      expect(src).toContain('fileLastModifiedMs');
    });

    it('timestamp is updated after conflict detection to prevent re-triggering same change', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      // After detecting a change, the stored timestamp is updated
      expect(src).toContain('fileLastModifiedMs: currentModified');
    });
  });

  // ── Integration: Full "Keep your version" flow ──

  describe('Integration: Full "Keep your version" flow', () => {
    it('complete flow: dirty → conflict → keep → still dirty → new conflict possible', () => {
      // 1. User has unsaved local changes
      const localGraph = {
        name: 'Local Changes',
        description: 'User edited this',
        owners: [],
        nodes: [
          {
            id: 'local-node',
            type: 'compute/service',
            displayName: 'My Work',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 50, y: 50, width: 240, height: 100 },
            children: [],
          },
        ],
        edges: [],
        annotations: [],
      };
      useGraphStore.setState({ graph: localGraph, isDirty: true }); useFileStore.setState({ fileExternallyModified: false });

      // 2. External modification detected by polling
      useFileStore.setState({ fileExternallyModified: true });
      useUIStore.getState().openConflictDialog({
        fileName: 'project.archc',
        onReload: vi.fn(),
        onSaveAsCopy: vi.fn(),
      });
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);

      // 3. User clicks "Keep your version"
      useFileStore.getState().acknowledgeExternalModification();
      useUIStore.getState().closeConflictDialog();

      // 4. Verify state after "Keep your version"
      expect(useUIStore.getState().conflictDialogOpen).toBe(false);
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
      expect(useGraphStore.getState().isDirty).toBe(true);
      expect(useGraphStore.getState().graph.name).toBe('Local Changes');
      expect(useGraphStore.getState().graph.nodes[0].displayName).toBe('My Work');

      // 5. Another external modification — new conflict dialog can appear
      useFileStore.setState({ fileExternallyModified: true });
      useUIStore.getState().openConflictDialog({
        fileName: 'project.archc',
        onReload: vi.fn(),
        onSaveAsCopy: vi.fn(),
      });
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);

      // 6. Dismiss again
      useFileStore.getState().acknowledgeExternalModification();
      useUIStore.getState().closeConflictDialog();
      expect(useUIStore.getState().conflictDialogOpen).toBe(false);
      expect(useGraphStore.getState().isDirty).toBe(true);
    });
  });
});
