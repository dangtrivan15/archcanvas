import { useEffect } from 'react';
import type { ChatProvider } from '@/core/ai/types';
import { providerDescriptors } from '@/components/ai/providerRegistry';
import { useChatStore } from '@/store/chatStore';

/**
 * Bootstrap all AI chat providers on mount.
 *
 * Iterates the provider registry: each descriptor creates its provider,
 * wires its transport, and registers it with the chat store (re-registering
 * on availability changes so Zustand subscribers see updates). Registry
 * order determines which provider is auto-selected as active.
 */
export function useAiProvider(): void {
  useEffect(() => {
    const register = (provider: ChatProvider) => {
      useChatStore.getState().registerProvider(provider);
    };
    const cleanups = providerDescriptors.map((d) => d.setup(register));

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);
}
