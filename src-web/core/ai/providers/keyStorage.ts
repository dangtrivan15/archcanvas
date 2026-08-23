/**
 * Per-provider API key storage.
 *
 * Keys are secrets and must never be persisted to `.archcanvas/settings.yaml`
 * (that directory is normally committed to the user's git repo — see spec
 * Decision 5). They live only in `localStorage`, keyed per provider id, the
 * same place the existing Anthropic key already lives (see apiKeyStore.ts's
 * `archcanvas:apiKey`). `aiSettingsStore`'s Zustand state intentionally does
 * NOT hold key values — only non-secret preferences — so this is a separate
 * module rather than a store field.
 */

const KEY_PREFIX = 'archcanvas:key:';

function storageKey(providerId: string): string {
  return `${KEY_PREFIX}${providerId}`;
}

/** Read a provider's API key from localStorage. Returns null if unset. */
export function getProviderApiKey(providerId: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(storageKey(providerId));
}

/** Persist a provider's API key to localStorage. */
export function setProviderApiKey(providerId: string, key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(storageKey(providerId), key);
}

/** Remove a provider's API key from localStorage. */
export function clearProviderApiKey(providerId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(storageKey(providerId));
}
