import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ChatProvider } from '@/core/ai/types';
import type { useAiSettingsStore as UseAiSettingsStoreType } from '@/store/aiSettingsStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSaveSettings = vi.fn();
vi.mock('@/storage/settingsCodec', () => ({
  saveSettings: (...args: unknown[]) => mockSaveSettings(...args),
}));

const mockFileStoreState: { fs: unknown } = { fs: null };
vi.mock('@/store/fileStore', () => ({
  useFileStore: { getState: () => mockFileStoreState },
}));

const mockChatStoreState: { providers: Map<string, ChatProvider> } = { providers: new Map() };
vi.mock('@/store/chatStore', () => ({
  useChatStore: { getState: () => mockChatStoreState },
}));

/** Simple in-memory localStorage mock (mirrors apiKeyStore.test.ts's helper). */
function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

function makeProvider(overrides: Partial<ChatProvider> = {}): ChatProvider {
  return {
    id: 'mock',
    displayName: 'Mock',
    available: true,
    capabilities: { tools: true, streaming: true },
    sendMessage: vi.fn() as unknown as ChatProvider['sendMessage'],
    loadHistory: vi.fn(),
    interrupt: vi.fn(),
    supportsTools: () => true,
    listModels: vi.fn().mockResolvedValue([{ id: 'model-a', label: 'Model A' }]),
    ...overrides,
  };
}

let mockStorage: Storage;
let useAiSettingsStore: typeof UseAiSettingsStoreType;

beforeEach(async () => {
  mockStorage = createMockStorage();
  vi.stubGlobal('localStorage', mockStorage);
  mockSaveSettings.mockReset();
  mockSaveSettings.mockResolvedValue(undefined);
  mockFileStoreState.fs = null;
  mockChatStoreState.providers = new Map();

  vi.resetModules();
  const mod = await import('@/store/aiSettingsStore');
  useAiSettingsStore = mod.useAiSettingsStore;
});

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

describe('aiSettingsStore — setters', () => {
  it('setModel sets the per-provider model', () => {
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o');
    expect(useAiSettingsStore.getState().byProvider.openai?.model).toBe('gpt-4o');
  });

  it('setBaseUrl sets the per-provider baseUrl', () => {
    useAiSettingsStore.getState().setBaseUrl('ollama', 'http://localhost:11434');
    expect(useAiSettingsStore.getState().byProvider.ollama?.baseUrl).toBe('http://localhost:11434');
  });

  it('setSelectedProvider sets selectedProviderId', () => {
    useAiSettingsStore.getState().setSelectedProvider('gemini');
    expect(useAiSettingsStore.getState().selectedProviderId).toBe('gemini');
  });

  it('setModel resets isValidated to false for that provider', () => {
    useAiSettingsStore.setState({
      byProvider: { openai: { model: 'gpt-4o-mini', isValidated: true, isValidating: false } },
    });
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o');
    expect(useAiSettingsStore.getState().byProvider.openai?.isValidated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

describe('aiSettingsStore — validate()', () => {
  it('flips isValidated true on a mocked successful listModels()-backed check', async () => {
    mockChatStoreState.providers.set('openai', makeProvider({ id: 'openai' }));

    await useAiSettingsStore.getState().validate('openai');

    const cfg = useAiSettingsStore.getState().byProvider.openai;
    expect(cfg?.isValidated).toBe(true);
    expect(cfg?.isValidating).toBe(false);
    expect(cfg?.error).toBeUndefined();
  });

  it('sets error and isValidated:false when listModels() rejects', async () => {
    const provider = makeProvider({
      id: 'openai',
      listModels: vi.fn().mockRejectedValue(new Error('invalid API key')),
    });
    mockChatStoreState.providers.set('openai', provider);

    await useAiSettingsStore.getState().validate('openai');

    const cfg = useAiSettingsStore.getState().byProvider.openai;
    expect(cfg?.isValidated).toBe(false);
    expect(cfg?.isValidating).toBe(false);
    expect(cfg?.error).toBe('invalid API key');
  });

  it('sets an error when no provider is registered for the id', async () => {
    await useAiSettingsStore.getState().validate('unregistered');

    const cfg = useAiSettingsStore.getState().byProvider.unregistered;
    expect(cfg?.isValidated).toBe(false);
    expect(cfg?.error).toMatch(/not available/);
  });

  it('sets isValidating true while the check is in flight', async () => {
    let resolveListModels!: (models: unknown[]) => void;
    const pending = new Promise((resolve) => {
      resolveListModels = resolve;
    });
    const provider = makeProvider({ id: 'openai', listModels: vi.fn().mockReturnValue(pending) });
    mockChatStoreState.providers.set('openai', provider);

    const validatePromise = useAiSettingsStore.getState().validate('openai');
    expect(useAiSettingsStore.getState().byProvider.openai?.isValidating).toBe(true);

    resolveListModels([]);
    await validatePromise;
    expect(useAiSettingsStore.getState().byProvider.openai?.isValidating).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Persistence: fs vs localStorage fallback
// ---------------------------------------------------------------------------

describe('aiSettingsStore — persistence', () => {
  it('persists via saveSettings when a project fs is available', () => {
    mockFileStoreState.fs = { fake: 'fs' };

    useAiSettingsStore.getState().setModel('openai', 'gpt-4o');

    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    const [fsArg, settingsArg] = mockSaveSettings.mock.calls[0];
    expect(fsArg).toBe(mockFileStoreState.fs);
    expect(settingsArg.ai.providers.openai).toEqual({ model: 'gpt-4o' });
  });

  it('does not write to localStorage when persisting via fs', () => {
    mockFileStoreState.fs = { fake: 'fs' };
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o');
    expect(mockStorage.getItem('archcanvas:aiSettingsFallback')).toBeNull();
  });

  it('falls back to localStorage when no fs is available', () => {
    mockFileStoreState.fs = null;

    useAiSettingsStore.getState().setBaseUrl('ollama', 'http://localhost:11434');

    expect(mockSaveSettings).not.toHaveBeenCalled();
    const raw = mockStorage.getItem('archcanvas:aiSettingsFallback');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.ai.providers.ollama).toEqual({ baseUrl: 'http://localhost:11434' });
  });

  it('hydrates initial state from the localStorage fallback at store creation', async () => {
    mockStorage.setItem(
      'archcanvas:aiSettingsFallback',
      JSON.stringify({
        ai: { selectedProviderId: 'gemini', providers: { gemini: { model: 'gemini-2.0-flash' } } },
      }),
    );

    vi.resetModules();
    const mod = await import('@/store/aiSettingsStore');
    const freshStore = mod.useAiSettingsStore;

    expect(freshStore.getState().selectedProviderId).toBe('gemini');
    expect(freshStore.getState().byProvider.gemini?.model).toBe('gemini-2.0-flash');
  });
});

// ---------------------------------------------------------------------------
// hydrateFromSettings()
// ---------------------------------------------------------------------------

describe('aiSettingsStore — hydrateFromSettings()', () => {
  it('populates selectedProviderId and byProvider without persisting', () => {
    useAiSettingsStore.getState().hydrateFromSettings({
      ai: { selectedProviderId: 'openai', providers: { openai: { model: 'gpt-4o' } } },
    });

    expect(useAiSettingsStore.getState().selectedProviderId).toBe('openai');
    expect(useAiSettingsStore.getState().byProvider.openai?.model).toBe('gpt-4o');
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('does not overwrite selectedProviderId when settings.ai.selectedProviderId is absent', () => {
    useAiSettingsStore.getState().setSelectedProvider('claude-code');
    mockSaveSettings.mockClear();

    useAiSettingsStore.getState().hydrateFromSettings({ ai: { providers: {} } });

    expect(useAiSettingsStore.getState().selectedProviderId).toBe('claude-code');
  });
});
