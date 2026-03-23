/**
 * API key store — manages Anthropic API key, model selection, and validation.
 *
 * Persists key and model to localStorage. Provides validateKey() which
 * tests the key against the Anthropic models.list() endpoint (free, no token cost).
 */

import { create } from 'zustand';

export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6-20250919', label: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6-20250919', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
] as const;

export const DEFAULT_MODEL = 'claude-sonnet-4-6-20250919';

interface ApiKeyState {
  apiKey: string | null;
  model: string;
  isValidated: boolean;
  isValidating: boolean;
  error: string | null;

  setApiKey(key: string): void;
  setModel(model: string): void;
  clearApiKey(): void;
  validateKey(): Promise<boolean>;
}

export const useApiKeyStore = create<ApiKeyState>((set, get) => ({
  apiKey: localStorage.getItem('archcanvas:apiKey'),
  model: localStorage.getItem('archcanvas:model') ?? DEFAULT_MODEL,
  isValidated: false,
  isValidating: false,
  error: null,

  setApiKey(key: string) {
    localStorage.setItem('archcanvas:apiKey', key);
    set({ apiKey: key, isValidated: false, error: null });
  },

  setModel(model: string) {
    localStorage.setItem('archcanvas:model', model);
    set({ model });
  },

  clearApiKey() {
    localStorage.removeItem('archcanvas:apiKey');
    set({ apiKey: null, isValidated: false, error: null });
  },

  async validateKey() {
    const { apiKey } = get();
    if (!apiKey) {
      set({ error: 'No API key configured', isValidated: false });
      return false;
    }
    set({ isValidating: true, error: null });
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      await client.models.list();
      set({ isValidated: true, isValidating: false });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      set({ isValidated: false, isValidating: false, error: message });
      return false;
    }
  },
}));
