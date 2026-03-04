/**
 * AI configuration module.
 *
 * Loads the Anthropic API key from:
 *   1. In-memory cache (set by Settings dialog or loaded at startup)
 *   2. VITE_ANTHROPIC_API_KEY environment variable (development fallback)
 *
 * On app load, the stored key is read from platform preferences
 * (localStorage on web, @capacitor/preferences on native) and cached.
 * The Settings dialog updates the cached key and persists it.
 *
 * Never hardcode API keys in source code.
 */

import { preferences } from '@/core/platform/preferencesAdapter';

/** localStorage / Capacitor Preferences key for the API key */
export const API_KEY_PREFERENCE_KEY = 'anthropic-api-key';

/**
 * In-memory cached API key. Updated by:
 * - initializeApiKey() on app load (reads from preferences)
 * - setStoredApiKey() from Settings dialog
 * - clearStoredApiKey() to remove
 */
let cachedApiKey: string | null = null;

/** Whether the initial load from preferences has completed */
let initialized = false;

/**
 * Initialize the API key from stored preferences.
 * Called once during app startup. If a key is stored, it takes priority
 * over the environment variable.
 */
export async function initializeApiKey(): Promise<void> {
  if (initialized) return;
  try {
    const storedKey = await preferences.get(API_KEY_PREFERENCE_KEY);
    if (storedKey && storedKey.trim() !== '') {
      cachedApiKey = storedKey.trim();
    }
  } catch (e) {
    console.warn('[ai/config] Failed to load stored API key:', e);
  }
  initialized = true;
}

/**
 * Save an API key to preferences and update the in-memory cache.
 * Called from the Settings dialog when user saves a key.
 */
export async function setStoredApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (trimmed === '') {
    await clearStoredApiKey();
    return;
  }
  cachedApiKey = trimmed;
  await preferences.set(API_KEY_PREFERENCE_KEY, trimmed);
}

/**
 * Remove the stored API key from preferences and clear the cache.
 */
export async function clearStoredApiKey(): Promise<void> {
  cachedApiKey = null;
  await preferences.remove(API_KEY_PREFERENCE_KEY);
}

/**
 * Get the current API key from the in-memory cache (read-only, sync).
 * Used internally by the getter functions below.
 */
export function getCachedApiKey(): string | null {
  return cachedApiKey;
}

/**
 * Get the Anthropic API key.
 * Priority: stored/cached key > VITE_ANTHROPIC_API_KEY env var.
 * Returns undefined if not set.
 */
export function getAnthropicApiKey(): string | undefined {
  // 1. Check cached key (from preferences/Settings)
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // 2. Fall back to environment variable
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  return envKey && envKey.trim() !== '' ? envKey.trim() : undefined;
}

/**
 * Check if the Anthropic API key is configured (from any source).
 */
export function isAIConfigured(): boolean {
  return getAnthropicApiKey() !== undefined;
}

/**
 * AI configuration object.
 * All AI-related config should be centralized here.
 */
export const aiConfig = {
  /** Model to use for chat completions */
  model: 'claude-sonnet-4-20250514',
  /** Maximum tokens in response */
  maxTokens: 4096,
  /** API endpoint (uses default Anthropic endpoint) */
  get apiKey(): string | undefined {
    return getAnthropicApiKey();
  },
  /** Whether AI features are available */
  get isConfigured(): boolean {
    return isAIConfigured();
  },
} as const;
