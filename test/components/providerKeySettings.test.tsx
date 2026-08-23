import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useChatStore } from '@/store/chatStore';
import { useAiSettingsStore } from '@/store/aiSettingsStore';
import { ProviderKeySettings } from '@/components/ai/ProviderKeySettings';
import { OLLAMA_PROVIDER_ID } from '@/core/ai/providers/ollama';
import type { ChatProvider, ModelInfo } from '@/core/ai/types';

// Regression coverage for the SSRF-shaped issue found in Code Review
// iteration 3: ProviderKeySettings used to call `provider.listModels()`
// unconditionally on mount. For Ollama that fires an unauthenticated
// `fetch(baseUrl + '/api/tags')`, and `baseUrl`/`selectedProviderId` can
// both arrive from `.archcanvas/settings.yaml` (hydrateFromSettings) —
// a file that may be synced through a shared repo. Opening the AI Settings
// dialog for an unrelated reason, while a repo-supplied config had made
// Ollama the active provider, would silently hit an attacker-chosen host
// with zero explicit user action. The fix gates the live-list fetch behind
// `isValidated`, which only flips true via an explicit "Test Connection"
// click.

function makeProvider(overrides: Partial<ChatProvider> = {}): ChatProvider {
  return {
    id: OLLAMA_PROVIDER_ID,
    displayName: 'Ollama',
    available: true,
    capabilities: { tools: true, streaming: true },
    sendMessage: vi.fn() as unknown as ChatProvider['sendMessage'],
    loadHistory: vi.fn(),
    interrupt: vi.fn(),
    supportsTools: () => true,
    listModels: vi.fn().mockResolvedValue([{ id: 'llama3', label: 'Llama 3' }] as ModelInfo[]),
    ...overrides,
  };
}

beforeEach(() => {
  useChatStore.setState({ providers: new Map(), activeProviderId: null });
  useAiSettingsStore.setState({ byProvider: {}, selectedProviderId: null });
});

describe('ProviderKeySettings — model list fetch gating', () => {
  it('does NOT call listModels() merely from mounting, even when the provider is already registered', async () => {
    const listModels = vi.fn().mockResolvedValue([{ id: 'llama3', label: 'Llama 3' }] as ModelInfo[]);
    const provider = makeProvider({ listModels });
    useChatStore.getState().registerProvider(provider);

    render(<ProviderKeySettings providerId={OLLAMA_PROVIDER_ID} />);

    // Give any stray microtask/effect a chance to run before asserting the negative.
    await new Promise((r) => setTimeout(r, 0));
    expect(listModels).not.toHaveBeenCalled();
  });

  it('does NOT call listModels() on mount even when baseUrl was just hydrated from a settings file', async () => {
    const listModels = vi.fn().mockResolvedValue([{ id: 'llama3', label: 'Llama 3' }] as ModelInfo[]);
    const provider = makeProvider({ listModels });
    useChatStore.getState().registerProvider(provider);

    // Simulates App.tsx's loadSettings().then(hydrateFromSettings) path with
    // an attacker-supplied host in `.archcanvas/settings.yaml`.
    useAiSettingsStore.getState().hydrateFromSettings({
      ai: {
        selectedProviderId: OLLAMA_PROVIDER_ID,
        providers: { [OLLAMA_PROVIDER_ID]: { baseUrl: 'http://attacker.example/api' } },
      },
    });

    render(<ProviderKeySettings providerId={OLLAMA_PROVIDER_ID} />);

    await new Promise((r) => setTimeout(r, 0));
    expect(listModels).not.toHaveBeenCalled();
  });

  it('calls listModels() and refreshes the dropdown only after an explicit "Test Connection" click', async () => {
    const listModels = vi.fn().mockResolvedValue([{ id: 'llama3', label: 'Llama 3' }] as ModelInfo[]);
    const provider = makeProvider({ listModels });
    useChatStore.getState().registerProvider(provider);

    render(<ProviderKeySettings providerId={OLLAMA_PROVIDER_ID} />);
    expect(listModels).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Test connection'));

    await waitFor(() => expect(listModels).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
  });
});
