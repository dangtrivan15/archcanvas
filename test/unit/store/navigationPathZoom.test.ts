/**
 * Tests for Feature #97: Navigation path state updates correctly on zoom.
 * Verifies the navigation store maintains correct path state during zoom.
 *
 * Steps:
 * 1. Verify initial path is []
 * 2. Zoom into node A, verify path is [A.id]
 * 3. Zoom into child B, verify path is [A.id, B.id]
 * 4. Zoom out, verify path is [A.id]
 * 5. Zoom to root, verify path is []
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from '@/store/navigationStore';

describe('Feature #97: Navigation path state updates correctly on zoom', () => {
  beforeEach(() => {
    // Reset navigation store to initial state before each test
    useNavigationStore.setState({ path: [] });
  });

  describe('Feature verification steps', () => {
    it('follows the complete zoom in/out/root flow correctly', () => {
      const nodeAId = 'node-a-001';
      const nodeBId = 'node-b-002';

      // Step 1: Verify initial path is []
      expect(useNavigationStore.getState().path).toEqual([]);

      // Step 2: Zoom into node A, verify path is [A.id]
      useNavigationStore.getState().zoomIn(nodeAId);
      expect(useNavigationStore.getState().path).toEqual([nodeAId]);

      // Step 3: Zoom into child B, verify path is [A.id, B.id]
      useNavigationStore.getState().zoomIn(nodeBId);
      expect(useNavigationStore.getState().path).toEqual([nodeAId, nodeBId]);

      // Step 4: Zoom out, verify path is [A.id]
      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual([nodeAId]);

      // Step 5: Zoom to root, verify path is []
      useNavigationStore.getState().zoomToRoot();
      expect(useNavigationStore.getState().path).toEqual([]);
    });
  });

  describe('zoomIn behavior', () => {
    it('appends node ID to path on zoom in', () => {
      useNavigationStore.getState().zoomIn('node-1');
      expect(useNavigationStore.getState().path).toEqual(['node-1']);
    });

    it('builds path incrementally with multiple zoom-ins', () => {
      useNavigationStore.getState().zoomIn('level-1');
      useNavigationStore.getState().zoomIn('level-2');
      useNavigationStore.getState().zoomIn('level-3');
      expect(useNavigationStore.getState().path).toEqual([
        'level-1',
        'level-2',
        'level-3',
      ]);
    });

    it('handles deep nesting (5+ levels)', () => {
      for (let i = 1; i <= 5; i++) {
        useNavigationStore.getState().zoomIn(`depth-${i}`);
      }
      expect(useNavigationStore.getState().path).toEqual([
        'depth-1',
        'depth-2',
        'depth-3',
        'depth-4',
        'depth-5',
      ]);
      expect(useNavigationStore.getState().path).toHaveLength(5);
    });
  });

  describe('zoomOut behavior', () => {
    it('removes last element from path on zoom out', () => {
      useNavigationStore.setState({ path: ['a', 'b', 'c'] });
      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual(['a', 'b']);
    });

    it('zooms out to root from single-level path', () => {
      useNavigationStore.setState({ path: ['a'] });
      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('zooms out from empty path results in empty path', () => {
      useNavigationStore.setState({ path: [] });
      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('sequential zoom outs navigate back to root', () => {
      useNavigationStore.setState({ path: ['a', 'b', 'c'] });

      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual(['a', 'b']);

      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual(['a']);

      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual([]);
    });
  });

  describe('zoomToRoot behavior', () => {
    it('resets path to empty from any depth', () => {
      useNavigationStore.setState({ path: ['x', 'y', 'z'] });
      useNavigationStore.getState().zoomToRoot();
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('is a no-op when already at root', () => {
      useNavigationStore.setState({ path: [] });
      useNavigationStore.getState().zoomToRoot();
      expect(useNavigationStore.getState().path).toEqual([]);
    });
  });

  describe('zoomToLevel behavior', () => {
    it('jumps directly to a specific path', () => {
      useNavigationStore.getState().zoomToLevel(['a', 'b']);
      expect(useNavigationStore.getState().path).toEqual(['a', 'b']);
    });

    it('can jump to root level (empty array)', () => {
      useNavigationStore.setState({ path: ['deep', 'path'] });
      useNavigationStore.getState().zoomToLevel([]);
      expect(useNavigationStore.getState().path).toEqual([]);
    });

    it('replaces existing path entirely', () => {
      useNavigationStore.setState({ path: ['old-a', 'old-b'] });
      useNavigationStore.getState().zoomToLevel(['new-x', 'new-y', 'new-z']);
      expect(useNavigationStore.getState().path).toEqual([
        'new-x',
        'new-y',
        'new-z',
      ]);
    });
  });

  describe('mixed zoom operations', () => {
    it('zoom in, zoom out, zoom in creates correct path', () => {
      useNavigationStore.getState().zoomIn('parent');
      useNavigationStore.getState().zoomIn('child-a');
      useNavigationStore.getState().zoomOut();
      useNavigationStore.getState().zoomIn('child-b');

      expect(useNavigationStore.getState().path).toEqual([
        'parent',
        'child-b',
      ]);
    });

    it('zoomToLevel then zoomIn builds on the set path', () => {
      useNavigationStore.getState().zoomToLevel(['service-a']);
      useNavigationStore.getState().zoomIn('handler-1');

      expect(useNavigationStore.getState().path).toEqual([
        'service-a',
        'handler-1',
      ]);
    });

    it('zoomToRoot then zoomIn starts fresh path', () => {
      useNavigationStore.setState({ path: ['old-path'] });
      useNavigationStore.getState().zoomToRoot();
      useNavigationStore.getState().zoomIn('new-root-child');

      expect(useNavigationStore.getState().path).toEqual(['new-root-child']);
    });
  });
});
