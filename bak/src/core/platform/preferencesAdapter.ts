/**
 * Preferences Adapter — cross-platform key-value storage.
 *
 * Abstracts localStorage (web) vs @capacitor/preferences (native iOS).
 * All preferences are stored under a common "archcanvas:" prefix namespace.
 *
 * Usage:
 *   import { preferences } from '@/core/platform/preferencesAdapter';
 *   await preferences.set('anthropic-api-key', 'sk-ant-...');
 *   const key = await preferences.get('anthropic-api-key');
 *   await preferences.remove('anthropic-api-key');
 */

import { isNative } from './platformBridge';

const NAMESPACE = 'archcanvas:';

/**
 * Get a value by key from platform storage.
 * Returns null if not found.
 */
export async function get(key: string): Promise<string | null> {
  const namespacedKey = `${NAMESPACE}${key}`;

  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const result = await Preferences.get({ key: namespacedKey });
      return result.value;
    } catch (e) {
      console.warn(
        '[preferencesAdapter] Capacitor Preferences get failed, falling back to localStorage:',
        e,
      );
    }
  }

  // Web fallback: localStorage
  try {
    return localStorage.getItem(namespacedKey);
  } catch {
    return null;
  }
}

/**
 * Set a value by key in platform storage.
 */
export async function set(key: string, value: string): Promise<void> {
  const namespacedKey = `${NAMESPACE}${key}`;

  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: namespacedKey, value });
      return;
    } catch (e) {
      console.warn(
        '[preferencesAdapter] Capacitor Preferences set failed, falling back to localStorage:',
        e,
      );
    }
  }

  // Web fallback: localStorage
  try {
    localStorage.setItem(namespacedKey, value);
  } catch (e) {
    console.warn('[preferencesAdapter] localStorage set failed:', e);
  }
}

/**
 * Remove a value by key from platform storage.
 */
export async function remove(key: string): Promise<void> {
  const namespacedKey = `${NAMESPACE}${key}`;

  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: namespacedKey });
      return;
    } catch (e) {
      console.warn(
        '[preferencesAdapter] Capacitor Preferences remove failed, falling back to localStorage:',
        e,
      );
    }
  }

  // Web fallback: localStorage
  try {
    localStorage.removeItem(namespacedKey);
  } catch (e) {
    console.warn('[preferencesAdapter] localStorage remove failed:', e);
  }
}

/**
 * Synchronously get a value by key from platform storage.
 * On web: reads from localStorage directly (fast, no await needed).
 * On native: returns null (use async `get()` for native; hydrate after mount).
 *
 * This exists for store initialization where sync access is required.
 */
export function getSync(key: string): string | null {
  if (typeof window === 'undefined') return null;
  const namespacedKey = `${NAMESPACE}${key}`;
  try {
    return localStorage.getItem(namespacedKey);
  } catch {
    return null;
  }
}

/** Convenience wrapper */
export const preferences = { get, getSync, set, remove } as const;
