import { useEffect, useRef } from 'react';
import { WebSocketClaudeCodeProvider } from '@/core/ai/webSocketProvider';
import { useChatStore } from '@/store/chatStore';

/**
 * Bootstrap the AI chat provider on mount.
 *
 * Creates a WebSocketClaudeCodeProvider, connects it to the Vite dev server's
 * AI bridge endpoint, and registers it with the chat store.  Re-registers on
 * every connection-state change so Zustand subscribers see the updated
 * `provider.available` value.
 */
export function useAiProvider(): void {
  const providerRef = useRef<WebSocketClaudeCodeProvider | null>(null);

  useEffect(() => {
    const provider = new WebSocketClaudeCodeProvider();
    providerRef.current = provider;

    // Derive WebSocket URL from current page origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/__archcanvas_ai`;

    // Register with chatStore (auto-selects as active since it's the only provider)
    useChatStore.getState().registerProvider(provider);

    // Re-register on connect/disconnect so Zustand sees the change
    provider.setConnectionChangeCallback(() => {
      useChatStore.getState().registerProvider(provider);
    });

    provider.connect(wsUrl);

    return () => {
      provider.setConnectionChangeCallback(null);
      provider.disconnect();
    };
  }, []);
}
