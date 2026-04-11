import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  persistLastActiveProject,
  getLastActiveProject,
  clearLastActiveProject,
} from '@/core/lastActiveProject';

const STORAGE_KEY = 'archcanvas:lastActiveProject';

describe('lastActiveProject', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // persistLastActiveProject
  // ---------------------------------------------------------------------------

  describe('persistLastActiveProject', () => {
    it('writes the project path as a plain string', () => {
      persistLastActiveProject('/home/user/my-project');

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBe('/home/user/my-project');
    });

    it('overwrites the previous entry on subsequent calls', () => {
      persistLastActiveProject('/first/project');
      persistLastActiveProject('/second/project');

      expect(localStorage.getItem(STORAGE_KEY)).toBe('/second/project');
    });

    it('is a no-op when projectPath is null', () => {
      persistLastActiveProject(null);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('is a no-op when projectPath is empty string', () => {
      persistLastActiveProject('');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('silently ignores localStorage errors', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => persistLastActiveProject('/some/path')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getLastActiveProject
  // ---------------------------------------------------------------------------

  describe('getLastActiveProject', () => {
    it('returns the stored path', () => {
      localStorage.setItem(STORAGE_KEY, '/home/user/project');

      expect(getLastActiveProject()).toBe('/home/user/project');
    });

    it('does NOT remove the entry after reading (read-only)', () => {
      localStorage.setItem(STORAGE_KEY, '/home/user/project');

      getLastActiveProject();

      expect(localStorage.getItem(STORAGE_KEY)).toBe('/home/user/project');
    });

    it('returns null when no entry exists', () => {
      expect(getLastActiveProject()).toBeNull();
    });

    it('returns null for empty string value', () => {
      localStorage.setItem(STORAGE_KEY, '');
      expect(getLastActiveProject()).toBeNull();
    });

    it('silently returns null when localStorage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(getLastActiveProject()).toBeNull();
    });

    it('returns path regardless of age (no staleness guard)', () => {
      // Stored value is a plain string, not JSON with timestamp —
      // there is no staleness check by design
      localStorage.setItem(STORAGE_KEY, '/old/project');

      expect(getLastActiveProject()).toBe('/old/project');
    });
  });

  // ---------------------------------------------------------------------------
  // clearLastActiveProject
  // ---------------------------------------------------------------------------

  describe('clearLastActiveProject', () => {
    it('removes the stored entry', () => {
      localStorage.setItem(STORAGE_KEY, '/home/user/project');

      clearLastActiveProject();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('is a no-op when no entry exists', () => {
      expect(() => clearLastActiveProject()).not.toThrow();
    });

    it('silently ignores localStorage errors', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => clearLastActiveProject()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Round-trip
  // ---------------------------------------------------------------------------

  describe('round-trip', () => {
    it('persist → get returns the same path', () => {
      persistLastActiveProject('/round/trip/project');

      expect(getLastActiveProject()).toBe('/round/trip/project');
    });

    it('persist → clear → get returns null', () => {
      persistLastActiveProject('/round/trip/project');
      clearLastActiveProject();

      expect(getLastActiveProject()).toBeNull();
    });
  });
});
