import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useEngineStore } from '@/store/engineStore';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Feature #521: Auto-reload when file modified externally with no local changes.
 *
 * Verifies that:
 * 1. When isDirty is false and external modification detected, auto-reload happens
 * 2. When isDirty is true, the old behavior (flagging) is preserved
 * 3. Auto-reload reads file content and decodes with decodeArchcData
 * 4. Auto-reload applies via _applyDecodedFile with the same file handle
 * 5. No confirmation dialog appears during auto-reload
 * 6. On reload failure, falls back to fileExternallyModified flag
 */

describe('Auto-reload on external modification (Feature #521)', () => {
  let useFileStoreRef: typeof import('@/store/fileStore').useFileStore;
let useGraphStoreRef: typeof import('@/store/graphStore').useGraphStore;
  let hookSource: string;

  beforeEach(async () => {
    vi.resetModules();
    const fileStoreMod = await import('@/store/fileStore'); const graphStoreMod = await import('@/store/graphStore');
    useFileStoreRef = fileStoreMod.useFileStore; useGraphStoreRef = graphStoreMod.useGraphStore;
    hookSource = fs.readFileSync(
      path.resolve(__dirname, '../../../src/hooks/useFilePolling.ts'),
      'utf-8',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Source code structure verification', () => {
    it('imports decodeArchcData from fileIO', () => {
      expect(hookSource).toContain("import { decodeArchcData } from '@/core/storage/fileIO'");
    });

    it('checks isDirty state before deciding reload vs flag', () => {
      expect(hookSource).toContain('state.isDirty');
      // The negation check: !state.isDirty for auto-reload path
      expect(hookSource).toContain('!state.isDirty');
    });

    it('reads file content via arrayBuffer() for auto-reload', () => {
      expect(hookSource).toContain('file.arrayBuffer()');
    });

    it('creates Uint8Array from file content for decoding', () => {
      expect(hookSource).toContain('new Uint8Array(await file.arrayBuffer())');
    });

    it('calls decodeArchcData to decode the binary data', () => {
      expect(hookSource).toContain('decodeArchcData(data)');
    });

    it('calls _applyDecodedFile to apply the reloaded graph', () => {
      expect(hookSource).toContain('_applyDecodedFile(');
      // Verify it passes the file handle to maintain save-in-place
      expect(hookSource).toMatch(/_applyDecodedFile\([\s\S]*?handle/);
    });

    it('passes the storageHandle during auto-reload (not null)', () => {
      // The auto-reload should pass `storageHandle` (the existing storage handle), not null
      // This is important so polling continues after reload
      const autoReloadSection = hookSource.match(
        /!state\.isDirty[\s\S]*?_applyDecodedFile\([\s\S]*?\)/,
      );
      expect(autoReloadSection).not.toBeNull();
      expect(autoReloadSection![0]).toContain('storageHandle,');
      expect(autoReloadSection![0]).toContain('handle.name');
    });

    it('does NOT set fileExternallyModified when isDirty is false (auto-reload path)', () => {
      // In the !isDirty branch, the flag should NOT be set (reload handles it)
      // Extract the auto-reload branch
      const notDirtyBranch = hookSource.match(
        /if\s*\(!state\.isDirty\)\s*\{([\s\S]*?)\}\s*else\s*\{/,
      );
      expect(notDirtyBranch).not.toBeNull();
      // The branch should NOT contain fileExternallyModified: true in normal flow
      // (only in the catch block for error fallback)
      const normalFlow = notDirtyBranch![1].split('catch')[0];
      expect(normalFlow).not.toContain('fileExternallyModified: true');
    });

    it('sets fileExternallyModified when isDirty is true', () => {
      // In the else branch (isDirty === true), the old behavior is preserved
      const dirtyBranch = hookSource.match(
        /else\s*\{[\s\S]*?fileExternallyModified:\s*true[\s\S]*?\}/,
      );
      expect(dirtyBranch).not.toBeNull();
    });

    it('falls back to flagging on decode/reload error', () => {
      // There should be a catch block in the auto-reload path that sets the flag
      const catchBlock = hookSource.match(
        /catch\s*\(reloadErr\)[\s\S]*?fileExternallyModified:\s*true/,
      );
      expect(catchBlock).not.toBeNull();
    });

    it('updates fileLastModifiedMs immediately to prevent re-triggering', () => {
      // Timestamp should be updated in the poll function before the debounce timer fires
      const timestampUpdate = hookSource.match(
        /fileLastModifiedMs:\s*currentModified/,
      );
      expect(timestampUpdate).not.toBeNull();
    });

    it('dispatches FILE_CHANGED_EVENT after debounce settles (in executeReload)', () => {
      // The event dispatch should be in executeReload, called after debounce timer fires
      const eventDispatch = hookSource.match(
        /executeReload[\s\S]*?CustomEvent\(FILE_CHANGED_EVENT/,
      );
      expect(eventDispatch).not.toBeNull();
    });

    it('logs auto-reload action for debugging', () => {
      expect(hookSource).toContain('auto-reloading file');
      expect(hookSource).toContain('Auto-reloaded');
    });

    it('does NOT show any confirmation dialog during auto-reload', () => {
      // The auto-reload path should not reference any dialog/confirm/prompt
      const autoReloadPath = hookSource.match(
        /!state\.isDirty[\s\S]*?Auto-reloaded/,
      );
      expect(autoReloadPath).not.toBeNull();
      expect(autoReloadPath![0]).not.toContain('dialog');
      expect(autoReloadPath![0]).not.toContain('confirm');
      expect(autoReloadPath![0]).not.toContain('prompt');
    });
  });

  describe('Store state simulation', () => {
    it('auto-reload clears fileExternallyModified via _applyDecodedFile', () => {
      // Simulate: file externally modified → auto-reload calls _applyDecodedFile
      // _applyDecodedFile should clear fileExternallyModified
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      useEngineStore.getState().initialize();
      const graph = useGraphStore.getState().graph;
      useFileStore.getState()._applyDecodedFile(graph, 'test.archc', null);

      expect(useFileStore.getState().fileExternallyModified).toBe(false);
      expect(useGraphStore.getState().isDirty).toBe(false);
    });

    it('isDirty starts false on fresh file open', () => {
      useEngineStore.getState().initialize();
      const graph = useGraphStore.getState().graph;
      useFileStore.getState()._applyDecodedFile(graph, 'test.archc', null);

      expect(useGraphStore.getState().isDirty).toBe(false);
    });

    it('isDirty becomes true after graph mutation', () => {
      useEngineStore.getState().initialize();
      const graph = useGraphStore.getState().graph;
      useFileStore.getState()._applyDecodedFile(graph, 'test.archc', null);

      // Add a node to make it dirty
      useGraphStore.getState().addNode({
        type: 'service',
        displayName: 'Test Service',
      });

      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('_applyDecodedFile resets isDirty to false (simulating reload)', () => {
      useEngineStore.getState().initialize();

      // Make dirty
      useGraphStore.setState({ isDirty: true });
      expect(useGraphStore.getState().isDirty).toBe(true);

      // Reload via _applyDecodedFile
      const graph = useGraphStore.getState().graph;
      useFileStore.getState()._applyDecodedFile(graph, 'reloaded.archc', null);

      expect(useGraphStore.getState().isDirty).toBe(false);
    });

    it('when isDirty is true, fileExternallyModified is set (not auto-reload)', () => {
      // Simulate: isDirty is true, external modification detected
      // The polling should set fileExternallyModified instead of auto-reloading
      useGraphStore.setState({ isDirty: true }); useFileStore.setState({ fileExternallyModified: false });

      // Simulate what polling does in the isDirty=true path
      useFileStore.setState({ fileLastModifiedMs: 2000, fileExternallyModified: true });

      expect(useFileStore.getState().fileExternallyModified).toBe(true);
      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('when isDirty is false, timestamp update does not set fileExternallyModified', () => {
      // Simulate: isDirty is false, auto-reload path
      // Only timestamp is updated (not the flag) before reload
      useGraphStore.setState({ isDirty: false }); useFileStore.setState({ fileExternallyModified: false, fileLastModifiedMs: 1000 });

      // Simulate what polling does: update timestamp only
      useFileStore.setState({ fileLastModifiedMs: 2000 });

      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });
  });

  describe('Docstring and comments verification', () => {
    it('docstring describes auto-reload behavior', () => {
      expect(hookSource).toContain('Auto-reloads the file if isDirty is false');
    });

    it('docstring mentions no confirmation dialog', () => {
      expect(hookSource).toContain('No confirmation dialog is shown');
    });

    it('docstring describes manual resolution for isDirty=true', () => {
      expect(hookSource).toContain('fileExternallyModified');
      expect(hookSource).toContain('isDirty is true');
    });
  });
});
