import { useEffect, useRef } from 'react';
import { WebSocketClaudeCodeProvider } from '@/core/ai/webSocketProvider';
import { useChatStore } from '@/store/chatStore';

/**
 * Resolve the WebSocket URL for the AI bridge.
 *
 * - **Tauri mode** (`__TAURI_INTERNALS__` in window): queries the Rust backend
 *   for the bridge sidecar port via `invoke('get_bridge_port')`.
 * - **Web mode**: derives the URL from the current page origin (Vite dev server).
 */
async function resolveBridgeUrl(): Promise<string> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { invoke } = await import('@tauri-apps/api/core');
    // Retry a few times — the sidecar may still be starting up.
    // The Rust command returns:
    //   Ok(port) — sidecar ready
    //   Err("Bridge starting...") — still booting, keep retrying
    //   Err("Bridge sidecar crashed (exit code: N)") — fatal, stop retrying
    let port: number | undefined;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        port = await invoke<number>('get_bridge_port');
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // If the sidecar crashed, don't waste time retrying
        if (msg.includes('crashed')) {
          throw new Error(msg);
        }
        // Still starting — wait and retry
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (port === undefined) {
      throw new Error('Bridge sidecar did not start within 5 seconds');
    }
    return `ws://127.0.0.1:${port}/__archcanvas_ai`;
  }

  // Web mode: use Vite dev server's WebSocket endpoint
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/__archcanvas_ai`;
}

/**
 * Bootstrap the AI chat provider on mount.
 *
 * Creates a WebSocketClaudeCodeProvider, connects it to the AI bridge
 * (Vite dev server in web mode, sidecar in Tauri mode), and registers
 * it with the chat store. Re-registers on every connection-state change
 * so Zustand subscribers see the updated `provider.available` value.
 */
export function useAiProvider(): void {
  const providerRef = useRef<WebSocketClaudeCodeProvider | null>(null);

  useEffect(() => {
    const provider = new WebSocketClaudeCodeProvider();
    providerRef.current = provider;

    // Register with chatStore (auto-selects as active since it's the only provider)
    useChatStore.getState().registerProvider(provider);

    // Re-register on connect/disconnect so Zustand sees the change
    provider.setConnectionChangeCallback(() => {
      useChatStore.getState().registerProvider(provider);
    });

    // Resolve the bridge URL (async for Tauri port discovery) and connect
    resolveBridgeUrl()
      .then((wsUrl) => {
        provider.connect(wsUrl);
      })
      .catch((err) => {
        console.error('[useAiProvider] Failed to resolve bridge URL:', err);
      });

    return () => {
      provider.setConnectionChangeCallback(null);
      provider.disconnect();
    };
  }, []);
}
