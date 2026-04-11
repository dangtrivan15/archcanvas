import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setLastActiveProject,
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
  // setLastActiveProject
  // ---------------------------------------------------------------------------

  describe('setLastActiveProject', () => {
    it('writes a JSON entry with the project path', () => {
      setLastActiveProject('/home/user/my-project');

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toEqual({ path: '/home/user/my-project' });
    });

    it('overwrites the previous entry', () => {
      setLastActiveProject('/first/project');
      setLastActiveProject('/second/project');

      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw!);
      expect(parsed.path).toBe('/second/project');
    });

    it('is a no-op when projectPath is null', () => {
      setLastActiveProject(null);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('is a no-op when projectPath is empty string', () => {
      setLastActiveProject('');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('silently ignores localStorage errors', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => setLastActiveProject('/some/path')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getLastActiveProject
  // ---------------------------------------------------------------------------

  describe('getLastActiveProject', () => {
    it('returns the path for a valid entry', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ path: '/home/user/project' }));

      expect(getLastActiveProject()).toBe('/home/user/project');
    });

    it('does NOT remove the entry after reading (read-only, not consumed)', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ path: '/home/user/project' }));

      getLastActiveProject();
      getLastActiveProject(); // read again

      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it('returns null when no entry exists', () => {
      expect(getLastActiveProject()).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json!!!');

      expect(getLastActiveProject()).toBeNull();
    });

    it('returns null when path field is missing', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ other: 'data' }));

      expect(getLastActiveProject()).toBeNull();
    });

    it('returns null when path is empty string', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ path: '' }));

      expect(getLastActiveProject()).toBeNull();
    });

    it('returns null when entry is a non-object JSON value', () => {
      localStorage.setItem(STORAGE_KEY, '"just a string"');
      expect(getLastActiveProject()).toBeNull();

      localStorage.setItem(STORAGE_KEY, '42');
      expect(getLastActiveProject()).toBeNull();

      localStorage.setItem(STORAGE_KEY, 'null');
      expect(getLastActiveProject()).toBeNull();
    });

    it('silently returns null when localStorage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(getLastActiveProject()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // clearLastActiveProject
  // ---------------------------------------------------------------------------

  describe('clearLastActiveProject', () => {
    it('removes the entry from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ path: '/some/project' }));

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
});
