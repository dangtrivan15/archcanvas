import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { useApiKeyStore as UseApiKeyStoreType } from '../../src-web/store/apiKeyStore';

const mockModelsList = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      models = { list: mockModelsList };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_opts: unknown) {}
    },
  };
});

/** Simple in-memory localStorage mock */
function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

let mockStorage: Storage;
let useApiKeyStore: typeof UseApiKeyStoreType;
let DEFAULT_MODEL: string;
let AVAILABLE_MODELS: readonly { id: string; label: string }[];

describe('apiKeyStore', () => {
  beforeEach(async () => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    mockModelsList.mockReset();
    vi.resetModules();
    const mod = await import('../../src-web/store/apiKeyStore');
    useApiKeyStore = mod.useApiKeyStore;
    DEFAULT_MODEL = mod.DEFAULT_MODEL;
    AVAILABLE_MODELS = mod.AVAILABLE_MODELS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('has default model', () => {
    expect(useApiKeyStore.getState().model).toBe('claude-sonnet-4-6-20250919');
  });

  it('sets and persists API key', () => {
    useApiKeyStore.getState().setApiKey('sk-ant-test-key');
    expect(useApiKeyStore.getState().apiKey).toBe('sk-ant-test-key');
    expect(mockStorage.getItem('archcanvas:apiKey')).toBe('sk-ant-test-key');
  });

  it('clears API key', () => {
    useApiKeyStore.getState().setApiKey('sk-ant-test-key');
    useApiKeyStore.getState().clearApiKey();
    expect(useApiKeyStore.getState().apiKey).toBeNull();
    expect(useApiKeyStore.getState().isValidated).toBe(false);
    expect(mockStorage.getItem('archcanvas:apiKey')).toBeNull();
  });

  it('sets and persists model', () => {
    useApiKeyStore.getState().setModel('claude-opus-4-6-20250919');
    expect(useApiKeyStore.getState().model).toBe('claude-opus-4-6-20250919');
    expect(mockStorage.getItem('archcanvas:model')).toBe('claude-opus-4-6-20250919');
  });

  it('setting API key resets validation state', () => {
    useApiKeyStore.setState({ isValidated: true });
    useApiKeyStore.getState().setApiKey('sk-ant-new-key');
    expect(useApiKeyStore.getState().isValidated).toBe(false);
    expect(useApiKeyStore.getState().error).toBeNull();
  });

  it('loads persisted key on creation', async () => {
    mockStorage.setItem('archcanvas:apiKey', 'sk-ant-stored');
    mockStorage.setItem('archcanvas:model', 'claude-opus-4-6-20250919');
    vi.resetModules();
    const mod = await import('../../src-web/store/apiKeyStore');
    expect(mod.useApiKeyStore.getState().apiKey).toBe('sk-ant-stored');
    expect(mod.useApiKeyStore.getState().model).toBe('claude-opus-4-6-20250919');
  });

  it('exports AVAILABLE_MODELS with all expected models', () => {
    expect(AVAILABLE_MODELS).toHaveLength(3);
    const ids = AVAILABLE_MODELS.map((m) => m.id);
    expect(ids).toContain('claude-opus-4-6-20250919');
    expect(ids).toContain('claude-sonnet-4-6-20250919');
    expect(ids).toContain('claude-haiku-4-5-20251001');
  });

  it('each model has id and label', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toEqual(expect.any(String));
      expect(model.label).toEqual(expect.any(String));
    }
  });

  describe('validateKey', () => {
    it('returns false and sets error when no key configured', async () => {
      const result = await useApiKeyStore.getState().validateKey();
      expect(result).toBe(false);
      expect(useApiKeyStore.getState().error).toBe('No API key configured');
      expect(useApiKeyStore.getState().isValidated).toBe(false);
    });

    it('sets isValidated on successful validation', async () => {
      useApiKeyStore.getState().setApiKey('sk-ant-valid-key');
      mockModelsList.mockResolvedValue({ data: [] });

      const result = await useApiKeyStore.getState().validateKey();
      expect(result).toBe(true);
      expect(useApiKeyStore.getState().isValidated).toBe(true);
      expect(useApiKeyStore.getState().isValidating).toBe(false);
      expect(useApiKeyStore.getState().error).toBeNull();
    });

    it('sets error on failed validation', async () => {
      useApiKeyStore.getState().setApiKey('sk-ant-bad-key');
      mockModelsList.mockRejectedValue(new Error('authentication_error'));

      const result = await useApiKeyStore.getState().validateKey();
      expect(result).toBe(false);
      expect(useApiKeyStore.getState().isValidated).toBe(false);
      expect(useApiKeyStore.getState().isValidating).toBe(false);
      expect(useApiKeyStore.getState().error).toBe('authentication_error');
    });
  });
});
