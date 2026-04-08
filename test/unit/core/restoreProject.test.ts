import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  persistProjectForRestore,
  consumeRestoreEntry,
} from '@/core/restoreProject';

const STORAGE_KEY = 'archcanvas:restoreProject';

describe('restoreProject', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // persistProjectForRestore
  // ---------------------------------------------------------------------------

  describe('persistProjectForRestore', () => {
    it('writes a JSON entry with path and timestamp', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      persistProjectForRestore('/home/user/my-project');

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toEqual({ path: '/home/user/my-project', timestamp: now });
    });

    it('is a no-op when projectPath is null', () => {
      persistProjectForRestore(null);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('is a no-op when projectPath is empty string', () => {
      persistProjectForRestore('');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('silently ignores localStorage errors', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => persistProjectForRestore('/some/path')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // consumeRestoreEntry
  // ---------------------------------------------------------------------------

  describe('consumeRestoreEntry', () => {
    it('returns the path for a valid, fresh entry', () => {
      const entry = { path: '/home/user/project', timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));

      expect(consumeRestoreEntry()).toBe('/home/user/project');
    });

    it('removes the entry after reading (consume-on-read)', () => {
      const entry = { path: '/home/user/project', timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));

      consumeRestoreEntry();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns null when no entry exists', () => {
      expect(consumeRestoreEntry()).toBeNull();
    });

    it('returns null and removes stale entries (>5 min old)', () => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      const entry = { path: '/stale/project', timestamp: sixMinutesAgo };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));

      expect(consumeRestoreEntry()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns the path for an entry exactly at the 5-min boundary', () => {
      const exactlyFiveMin = Date.now() - 5 * 60 * 1000;
      const entry = { path: '/boundary/project', timestamp: exactlyFiveMin };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));

      // At exactly 5 min, Date.now() - timestamp === MAX_AGE_MS, not > MAX_AGE_MS
      expect(consumeRestoreEntry()).toBe('/boundary/project');
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json!!!');

      expect(consumeRestoreEntry()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns null when path field is missing', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));

      expect(consumeRestoreEntry()).toBeNull();
    });

    it('returns null when timestamp field is missing', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ path: '/some/path' }));

      expect(consumeRestoreEntry()).toBeNull();
    });

    it('returns null when path is empty string', () => {
      const entry = { path: '', timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));

      expect(consumeRestoreEntry()).toBeNull();
    });

    it('returns null when entry is a non-object JSON value', () => {
      localStorage.setItem(STORAGE_KEY, '"just a string"');
      expect(consumeRestoreEntry()).toBeNull();

      localStorage.setItem(STORAGE_KEY, '42');
      expect(consumeRestoreEntry()).toBeNull();

      localStorage.setItem(STORAGE_KEY, 'null');
      expect(consumeRestoreEntry()).toBeNull();
    });

    it('silently returns null when localStorage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(consumeRestoreEntry()).toBeNull();
    });
  });
});
