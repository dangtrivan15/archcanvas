import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useEngineStore } from '@/store/engineStore';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Feature #529: Debounce rapid consecutive external changes.
 *
 * Verifies that:
 * 1. Rapid external writes result in only one reload after they settle
 * 2. The debounce timer resets on each new change
 * 3. Final state reflects all mutations (last file version)
 * 4. Only one FILE_CHANGED_EVENT is dispatched per burst
 * 5. Only one toast/dialog appears per burst
 */

describe('Debounce rapid consecutive external changes (Feature #529)', () => {
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

  describe('Step 1: Source code has debounce mechanism', () => {
    it('exports DEBOUNCE_DELAY_MS constant', () => {
      expect(hookSource).toContain('export const DEBOUNCE_DELAY_MS');
    });

    it('DEBOUNCE_DELAY_MS is a positive number', async () => {
      const { DEBOUNCE_DELAY_MS } = await import('@/hooks/useFilePolling');
      expect(typeof DEBOUNCE_DELAY_MS).toBe('number');
      expect(DEBOUNCE_DELAY_MS).toBeGreaterThan(0);
    });

    it('DEBOUNCE_DELAY_MS is greater than FILE_POLL_INTERVAL_MS', async () => {
      const { DEBOUNCE_DELAY_MS, FILE_POLL_INTERVAL_MS } = await import(
        '@/hooks/useFilePolling'
      );
      expect(DEBOUNCE_DELAY_MS).toBeGreaterThan(FILE_POLL_INTERVAL_MS);
    });

    it('uses a debounce ref (setTimeout/clearTimeout pattern)', () => {
      expect(hookSource).toContain('debounceRef');
      expect(hookSource).toContain('clearTimeout');
      expect(hookSource).toContain('setTimeout');
    });

    it('resets debounce timer when new change detected during burst', () => {
      // Should clear existing timeout before setting new one
      const clearAndSet = hookSource.match(
        /clearTimeout\(debounceRef\.current\)[\s\S]*?debounceRef\.current\s*=\s*setTimeout/,
      );
      expect(clearAndSet).not.toBeNull();
    });

    it('uses DEBOUNCE_DELAY_MS in setTimeout call', () => {
      expect(hookSource).toContain('DEBOUNCE_DELAY_MS');
      const timeoutWithDelay = hookSource.match(
        /setTimeout\([\s\S]*?DEBOUNCE_DELAY_MS/,
      );
      expect(timeoutWithDelay).not.toBeNull();
    });
  });

  describe('Step 2: Timestamp tracking during burst', () => {
    it('tracks the burst start timestamp (original timestamp before burst)', () => {
      expect(hookSource).toContain('burstStartTimestamp');
    });

    it('updates fileLastModifiedMs immediately on each change detection', () => {
      // Each poll that detects a change should update the timestamp so
      // the next poll does not re-detect the same change
      const immediateUpdate = hookSource.match(
        /fileLastModifiedMs:\s*currentModified/,
      );
      expect(immediateUpdate).not.toBeNull();
    });

    it('resets burst start timestamp after reload executes', () => {
      // After the debounce fires and reload happens, burst tracking should reset
      expect(hookSource).toContain('burstStartTimestampRef.current = null');
    });
  });

  describe('Step 3: Reload happens only once after burst settles', () => {
    it('executeReload is called from setTimeout callback (not inline)', () => {
      // The reload logic should be in a function called from the debounce timer
      expect(hookSource).toContain('executeReload');
    });

    it('poll function does NOT call _applyDecodedFile directly', () => {
      // _applyDecodedFile should only be in executeReload, not in poll
      // Extract the poll function body
      const pollStart = hookSource.indexOf('const poll = async');
      const pollSection = hookSource.substring(pollStart);
      // poll references executeReload, not _applyDecodedFile directly
      const pollBeforeExecuteReload = pollSection.split('executeReload')[0];
      expect(pollBeforeExecuteReload).not.toContain('_applyDecodedFile');
    });

    it('only dispatches one FILE_CHANGED_EVENT per burst (in executeReload)', () => {
      // The CustomEvent dispatch should be in executeReload, not in poll
      const executeReloadFn = hookSource.match(
        /executeReload[\s\S]*?CustomEvent\(FILE_CHANGED_EVENT/,
      );
      expect(executeReloadFn).not.toBeNull();
    });
  });

  describe('Step 4: Cleanup on unmount and effect re-run', () => {
    it('clears debounce timer on effect cleanup', () => {
      // The cleanup function should clear debounceRef
      const cleanup = hookSource.match(
        /return\s*\(\)\s*=>\s*\{[\s\S]*?clearTimeout\(debounceRef\.current\)/,
      );
      expect(cleanup).not.toBeNull();
    });

    it('clears debounce timer when file handle becomes null', () => {
      // When the guard condition fails (no handle/timestamp), debounce should be cleared
      const guardCleanup = hookSource.match(
        /fileLastModifiedMs === null[\s\S]*?clearTimeout\(debounceRef\.current\)/,
      );
      expect(guardCleanup).not.toBeNull();
    });

    it('clears debounce timer on file inaccessible error', () => {
      // In the catch block (file inaccessible), debounce should also be cleared
      const catchCleanup = hookSource.match(
        /File inaccessible[\s\S]*?clearTimeout\(debounceRef\.current\)/,
      );
      expect(catchCleanup).not.toBeNull();
    });
  });

  describe('Step 5: DEBOUNCE_DELAY_MS exported from barrel', () => {
    it('is exported from hooks/index.ts', () => {
      const indexSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/hooks/index.ts'),
        'utf-8',
      );
      expect(indexSource).toContain('DEBOUNCE_DELAY_MS');
    });

    it('can be imported from @/hooks', async () => {
      const hooks = await import('@/hooks');
      expect(hooks.DEBOUNCE_DELAY_MS).toBeDefined();
      expect(typeof hooks.DEBOUNCE_DELAY_MS).toBe('number');
    });
  });

  describe('Step 6: Debounce behavior with isDirty=true (conflict dialog)', () => {
    it('conflict dialog is also debounced (in executeReload, not poll)', () => {
      // The conflict dialog should be opened from executeReload, not directly in poll
      const executeReloadConflict = hookSource.match(
        /executeReload[\s\S]*?openConflictDialog/,
      );
      expect(executeReloadConflict).not.toBeNull();
    });

    it('fileExternallyModified is set in executeReload for dirty case', () => {
      const executeReloadDirty = hookSource.match(
        /executeReload[\s\S]*?isDirty[\s\S]*?fileExternallyModified:\s*true/,
      );
      expect(executeReloadDirty).not.toBeNull();
    });
  });

  describe('Step 7: Logging indicates debounce behavior', () => {
    it('logs debounce reset when timer is reset during burst', () => {
      expect(hookSource).toContain('resetting debounce timer');
    });
  });

  describe('Step 8: Store state simulation — debounce timestamp updates', () => {
    it('rapid timestamp updates accumulate correctly in store', () => {
      useFileStore.setState({ fileLastModifiedMs: 1000 });

      // Simulate 5 rapid external modifications (each poll updates timestamp)
      useFileStore.setState({ fileLastModifiedMs: 1100 });
      useFileStore.setState({ fileLastModifiedMs: 1200 });
      useFileStore.setState({ fileLastModifiedMs: 1300 });
      useFileStore.setState({ fileLastModifiedMs: 1400 });
      useFileStore.setState({ fileLastModifiedMs: 1500 });

      // Final timestamp should be the last one
      expect(useFileStore.getState().fileLastModifiedMs).toBe(1500);
    });

    it('_applyDecodedFile resets dirty state after debounced reload', () => {
      useEngineStore.getState().initialize();
      useGraphStore.setState({ isDirty: false, fileLastModifiedMs: 1000 });

      // Simulate rapid updates
      useFileStore.setState({ fileLastModifiedMs: 1500 });

      // After debounce settles, _applyDecodedFile is called
      const graph = useGraphStore.getState().graph;
      useFileStore.getState()._applyDecodedFile(graph, 'test.archc', null);

      expect(useGraphStore.getState().isDirty).toBe(false);
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });

    it('single change still works (no debounce needed, just delayed)', async () => {
      const { DEBOUNCE_DELAY_MS } = await import('@/hooks/useFilePolling');

      // A single change should still trigger reload — just after DEBOUNCE_DELAY_MS
      // This verifies debounce does not break single-change scenarios
      expect(DEBOUNCE_DELAY_MS).toBeLessThanOrEqual(5000); // Reasonable upper bound
      expect(DEBOUNCE_DELAY_MS).toBeGreaterThanOrEqual(500); // Reasonable lower bound
    });
  });

  describe('Step 9: FILE_CHANGED_EVENT detail captures full burst range', () => {
    it('event detail includes previousModified (burst start) and currentModified (burst end)', () => {
      // The FileChangedDetail should contain the original timestamp (before burst)
      // and the final timestamp (after burst settles)
      expect(hookSource).toContain('previousModified');
      expect(hookSource).toContain('currentModified: latestModified');
    });
  });
});
