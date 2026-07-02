import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API key store before importing the registry (the registry's
// api-key setup subscribes to it; AiProviderSettings imports AVAILABLE_MODELS)
const mockApiKeyState = {
  apiKey: null as string | null,
  model: 'claude-sonnet-4-6-20250919',
  isValidated: false,
  isValidating: false,
  error: null as string | null,
  setApiKey: vi.fn(),
  setModel: vi.fn(),
  clearApiKey: vi.fn(),
  validateKey: vi.fn().mockResolvedValue(true),
};

type SubscribeListener = (
  state: typeof mockApiKeyState,
  prev: typeof mockApiKeyState,
) => void;
let subscribeListener: SubscribeListener | null = null;
const unsubscribe = vi.fn(() => {
  subscribeListener = null;
});

vi.mock('@/store/apiKeyStore', () => ({
  useApiKeyStore: Object.assign(
    (selector: (s: typeof mockApiKeyState) => unknown) => selector(mockApiKeyState),
    {
      getState: () => mockApiKeyState,
      subscribe: vi.fn((listener: SubscribeListener) => {
        subscribeListener = listener;
        return unsubscribe;
      }),
    },
  ),
  AVAILABLE_MODELS: [
    { id: 'claude-sonnet-4-6-20250919', label: 'Claude Sonnet 4.6' },
  ],
}));

import {
  providerDescriptors,
  getProviderDescriptor,
} from '@/components/ai/providerRegistry';
import {
  WebSocketClaudeCodeProvider,
  CLAUDE_CODE_PROVIDER_ID,
} from '@/core/ai/webSocketProvider';
import { ApiKeyProvider, CLAUDE_API_KEY_PROVIDER_ID } from '@/core/ai/apiKeyProvider';
import { ApiKeySettings, ClaudeCodeSettings } from '@/components/ai/AiProviderSettings';

describe('providerRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeListener = null;
    mockApiKeyState.apiKey = null;
    mockApiKeyState.isValidated = false;
  });

  it('registers Claude Code first so chatStore auto-selects it as active', () => {
    expect(providerDescriptors.map((d) => d.id)).toEqual([
      CLAUDE_CODE_PROVIDER_ID,
      CLAUDE_API_KEY_PROVIDER_ID,
    ]);
  });

  it('looks up descriptors by id and returns undefined for unknown/null ids', () => {
    expect(getProviderDescriptor(CLAUDE_CODE_PROVIDER_ID)?.id).toBe(CLAUDE_CODE_PROVIDER_ID);
    expect(getProviderDescriptor('nonexistent')).toBeUndefined();
    expect(getProviderDescriptor(null)).toBeUndefined();
  });

  it('maps each provider to its settings component', () => {
    expect(getProviderDescriptor(CLAUDE_CODE_PROVIDER_ID)?.SettingsComponent).toBe(
      ClaudeCodeSettings,
    );
    expect(getProviderDescriptor(CLAUDE_API_KEY_PROVIDER_ID)?.SettingsComponent).toBe(
      ApiKeySettings,
    );
  });

  it('only the API key provider opens settings when selected while unavailable', () => {
    expect(
      getProviderDescriptor(CLAUDE_API_KEY_PROVIDER_ID)?.opensSettingsWhenUnavailable,
    ).toBe(true);
    expect(
      getProviderDescriptor(CLAUDE_CODE_PROVIDER_ID)?.opensSettingsWhenUnavailable,
    ).toBeUndefined();
  });

  describe('claude-code setup', () => {
    it('registers the provider synchronously, connects to the bridge, and disconnects on cleanup', async () => {
      const connectSpy = vi
        .spyOn(WebSocketClaudeCodeProvider.prototype, 'connect')
        .mockImplementation(() => {});
      const disconnectSpy = vi
        .spyOn(WebSocketClaudeCodeProvider.prototype, 'disconnect')
        .mockImplementation(() => {});

      const register = vi.fn();
      const cleanup = getProviderDescriptor(CLAUDE_CODE_PROVIDER_ID)!.setup(register);

      expect(register).toHaveBeenCalledTimes(1);
      expect(register.mock.calls[0][0]).toBeInstanceOf(WebSocketClaudeCodeProvider);

      // Bridge URL resolution is async (Tauri port discovery); flush it
      await vi.waitFor(() => {
        expect(connectSpy).toHaveBeenCalledWith(
          expect.stringContaining('/__archcanvas_ai'),
        );
      });

      cleanup();
      expect(disconnectSpy).toHaveBeenCalled();

      connectSpy.mockRestore();
      disconnectSpy.mockRestore();
    });
  });

  describe('api-key setup', () => {
    it('registers the provider and re-registers when validation state changes', () => {
      const register = vi.fn();
      const cleanup = getProviderDescriptor(CLAUDE_API_KEY_PROVIDER_ID)!.setup(register);

      expect(register).toHaveBeenCalledTimes(1);
      expect(register.mock.calls[0][0]).toBeInstanceOf(ApiKeyProvider);

      // Simulate validation flipping to true
      subscribeListener?.(
        { ...mockApiKeyState, isValidated: true },
        { ...mockApiKeyState, isValidated: false },
      );
      expect(register).toHaveBeenCalledTimes(2);

      // Unrelated state change does not re-register
      subscribeListener?.(
        { ...mockApiKeyState, isValidated: true },
        { ...mockApiKeyState, isValidated: true },
      );
      expect(register).toHaveBeenCalledTimes(2);

      cleanup();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('auto-validates a stored API key so the provider becomes available', () => {
      mockApiKeyState.apiKey = 'sk-ant-test';
      const cleanup = getProviderDescriptor(CLAUDE_API_KEY_PROVIDER_ID)!.setup(vi.fn());
      expect(mockApiKeyState.validateKey).toHaveBeenCalled();
      cleanup();
    });

    it('does not validate when no API key is stored', () => {
      const cleanup = getProviderDescriptor(CLAUDE_API_KEY_PROVIDER_ID)!.setup(vi.fn());
      expect(mockApiKeyState.validateKey).not.toHaveBeenCalled();
      cleanup();
    });
  });
});
