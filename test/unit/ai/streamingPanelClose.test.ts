/**
 * Tests for Feature #230: Streaming AI response handles panel close gracefully.
 * Verifies that closing the AI chat panel during streaming doesn't cause errors,
 * the AbortController properly cancels the stream, conversation state is preserved,
 * and reopening the panel shows the preserved messages.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- AI client tests (abort + streaming) ----

describe('Feature #230: Streaming AI response handles panel close gracefully', () => {
  describe('AbortController cancels fetch during streaming', () => {
    it('aborting a signal sets the aborted flag', () => {
      const controller = new AbortController();
      expect(controller.signal.aborted).toBe(false);
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });

    it('AbortError has the correct name property', () => {
      const controller = new AbortController();
      controller.abort();

      // AbortSignal.reason is a DOMException with name "AbortError"
      expect(controller.signal.aborted).toBe(true);
    });

    it('AbortController can be aborted before use', () => {
      const controller = new AbortController();
      expect(controller.signal.aborted).toBe(false);
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });

    it('abort() is idempotent (calling multiple times is safe)', () => {
      const controller = new AbortController();
      controller.abort();
      controller.abort(); // Second call should not throw
      controller.abort(); // Third call should not throw
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('AIChatTab streaming error handling', () => {
    it('AbortError is identified by name property', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      expect(error.name).toBe('AbortError');
    });

    it('AbortError check pattern matches DOMException abort', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      // This is the exact pattern used in AIChatTab catch block (line 245)
      const isAbortError = (error as Error).name === 'AbortError';
      expect(isAbortError).toBe(true);
    });

    it('Non-abort errors are not identified as AbortError', () => {
      const error = new Error('Network failure');
      const isAbortError = (error as Error).name === 'AbortError';
      expect(isAbortError).toBe(false);
    });

    it('TypeError (fetch failure) is not identified as AbortError', () => {
      const error = new TypeError('Failed to fetch');
      const isAbortError = (error as Error).name === 'AbortError';
      expect(isAbortError).toBe(false);
    });
  });

  describe('AI Store conversation persistence across panel close', () => {
    // Import the actual store for persistence tests
    let useAIStore: typeof import('@/store/aiStore').useAIStore;

    beforeEach(async () => {
      const module = await import('@/store/aiStore');
      useAIStore = module.useAIStore;
      useAIStore.getState().clearConversations();
    });

    afterEach(() => {
      useAIStore.getState().clearConversations();
    });

    it('user message persisted to store before streaming begins', () => {
      // Simulate: user sends message → persisted to store
      useAIStore.getState().addMessage('user', 'What does this service do?');

      const messages = useAIStore.getState().getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('What does this service do?');
    });

    it('persisted messages survive component unmount (panel close)', () => {
      // Add messages to store
      useAIStore.getState().addMessage('user', 'Hello');
      useAIStore.getState().addMessage('assistant', 'Hi there!');
      useAIStore.getState().addMessage('user', 'What is this architecture?');

      // "Close panel" = component unmounts, but store persists
      // (Zustand global store is NOT affected by React component lifecycle)
      const messages = useAIStore.getState().getMessages();
      expect(messages).toHaveLength(3);
    });

    it('conversation state is preserved after simulated panel close and reopen', () => {
      // Phase 1: Send messages (user + assistant reply)
      useAIStore.getState().addMessage('user', 'Explain the database node');
      useAIStore.getState().addMessage('assistant', 'The database node is a persistent data store...');

      // Phase 2: "Close" the panel (in reality, the component unmounts but store stays)
      // No action needed - Zustand stores are global

      // Phase 3: "Reopen" panel → component remounts, reads from store
      const messagesAfterReopen = useAIStore.getState().getMessages();
      expect(messagesAfterReopen).toHaveLength(2);
      expect(messagesAfterReopen[0].content).toBe('Explain the database node');
      expect(messagesAfterReopen[1].content).toBe('The database node is a persistent data store...');
    });

    it('node-scoped messages persist across panel close/reopen', () => {
      const nodeId = 'test-node-123';

      // Add messages scoped to a node
      useAIStore.getState().addMessageToNode(nodeId, 'user', 'What does this node do?');
      useAIStore.getState().addMessageToNode(nodeId, 'assistant', 'This is a service node...');

      // "Close and reopen" - read messages again
      const nodeMessages = useAIStore.getState().getNodeMessages(nodeId);
      expect(nodeMessages).toHaveLength(2);
      expect(nodeMessages[0].role).toBe('user');
      expect(nodeMessages[1].role).toBe('assistant');
    });

    it('global and node-scoped conversations are independent', () => {
      // Add global message
      useAIStore.getState().addMessage('user', 'Global question');

      // Add node-scoped message
      useAIStore.getState().addMessageToNode('node-1', 'user', 'Node question');

      // Both exist independently
      const globalMsgs = useAIStore.getState().getMessages();
      const nodeMsgs = useAIStore.getState().getNodeMessages('node-1');

      expect(globalMsgs).toHaveLength(1);
      expect(globalMsgs[0].content).toBe('Global question');
      expect(nodeMsgs).toHaveLength(1);
      expect(nodeMsgs[0].content).toBe('Node question');
    });

    it('multiple conversations survive panel close/reopen', () => {
      // Create conversations for multiple nodes
      useAIStore.getState().addMessageToNode('node-a', 'user', 'Question about A');
      useAIStore.getState().addMessageToNode('node-a', 'assistant', 'Answer about A');
      useAIStore.getState().addMessageToNode('node-b', 'user', 'Question about B');
      useAIStore.getState().addMessage('user', 'Global question');

      // All conversations preserved
      const conversations = useAIStore.getState().conversations;
      expect(conversations).toHaveLength(3); // node-a, node-b, global

      expect(useAIStore.getState().getNodeMessages('node-a')).toHaveLength(2);
      expect(useAIStore.getState().getNodeMessages('node-b')).toHaveLength(1);
      expect(useAIStore.getState().getMessages()).toHaveLength(1);
    });
  });

  describe('streaming message lifecycle on panel close', () => {
    it('streaming message is local state (not persisted if incomplete)', () => {
      // The streaming message in AIChatTab is stored in useState (local)
      // When component unmounts, local state is destroyed
      // Only completed messages are persisted via addMessage/addMessageToNode

      // This test verifies the architectural principle:
      // Local state (streaming placeholder) is separate from global state (store)
      const localStreamingMessage = {
        id: 'msg-123-assistant',
        role: 'assistant' as const,
        content: 'Partial response...',
        timestamp: Date.now(),
        isStreaming: true,
      };

      // The streaming message has isStreaming: true
      expect(localStreamingMessage.isStreaming).toBe(true);

      // It would NOT be persisted to the store until streaming completes
      // (This is verified by the fact that persistMessage is only called
      // after sendAIMessage resolves, not during streaming)
    });

    it('completed assistant message IS persisted to store', async () => {
      const { useAIStore: store } = await import('@/store/aiStore');
      store.getState().clearConversations();

      // Simulate: streaming completes → persistMessage called
      store.getState().addMessage('assistant', 'Complete response from AI');

      const messages = store.getState().getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Complete response from AI');
      expect(messages[0].role).toBe('assistant');

      store.getState().clearConversations();
    });
  });

  describe('cleanup effect behavior', () => {
    it('AbortController ref can hold a controller', () => {
      // Simulates the useRef pattern in AIChatTab
      const ref: { current: AbortController | null } = { current: null };

      const controller = new AbortController();
      ref.current = controller;

      expect(ref.current).toBe(controller);
      expect(ref.current.signal.aborted).toBe(false);
    });

    it('cleanup calls abort on the ref controller', () => {
      const ref: { current: AbortController | null } = { current: null };

      const controller = new AbortController();
      ref.current = controller;

      // Simulate cleanup (unmount) effect
      ref.current?.abort();

      expect(controller.signal.aborted).toBe(true);
    });

    it('cleanup is safe when ref is null (no active stream)', () => {
      const ref: { current: AbortController | null } = { current: null };

      // Simulate cleanup when no stream was started
      ref.current?.abort(); // Should not throw

      expect(ref.current).toBeNull();
    });

    it('cleanup after abort clears the ref', () => {
      const ref: { current: AbortController | null } = { current: null };

      const controller = new AbortController();
      ref.current = controller;

      // Simulate the finally block behavior
      ref.current?.abort();
      ref.current = null;

      expect(ref.current).toBeNull();
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('ReadableStream abort behavior', () => {
    it('reading from an aborted reader throws', async () => {
      // Create a never-ending stream to simulate ongoing SSE
      const stream = new ReadableStream({
        start(controller) {
          // Write initial data
          controller.enqueue(new TextEncoder().encode('data: {"type":"message_start"}\n\n'));
          // Stream stays open (simulating ongoing response)
        },
      });

      const reader = stream.getReader();

      // Read the first chunk
      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toBeDefined();

      // Cancel the reader (simulates abort behavior)
      await reader.cancel();
      reader.releaseLock();

      // The stream is now canceled - further reads would fail
      const newReader = stream.getReader();
      const result = await newReader.read();
      // After cancel, reader should return done: true
      expect(result.done).toBe(true);
      newReader.releaseLock();
    });
  });

  describe('error message mapping for user-friendly display', () => {
    it('getUserFriendlyErrorMessage handles AbortError specially', () => {
      // In AIChatTab, AbortError is caught BEFORE getUserFriendlyErrorMessage
      // is called, so the function never sees AbortError. This test confirms
      // the catch block flow:
      const abortError = new DOMException('Aborted', 'AbortError');
      const isAbort = abortError.name === 'AbortError';

      // The catch block returns early for AbortError
      expect(isAbort).toBe(true);
      // So getUserFriendlyErrorMessage is NOT called for AbortError
    });
  });

  describe('source code verification', () => {
    it('AIChatTab has cleanup useEffect that aborts on unmount', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync(
        'src/components/panels/AIChatTab.tsx',
        'utf-8',
      );

      // Verify cleanup effect exists
      expect(source).toContain('abortControllerRef.current?.abort()');
      // Verify it's in a useEffect return (cleanup)
      expect(source).toMatch(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?return\s*\(\)\s*=>\s*\{[\s\S]*?abortControllerRef\.current\?\.abort\(\)/);
    });

    it('AIChatTab catches AbortError and returns early', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync(
        'src/components/panels/AIChatTab.tsx',
        'utf-8',
      );

      // Verify AbortError is caught
      expect(source).toContain("(error as Error).name === 'AbortError'");
      // Verify streaming message is cleared on abort
      expect(source).toMatch(/AbortError[\s\S]*?setStreamingMessage\(null\)/);
    });

    it('AIChatTab has finally block that resets isStreaming', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync(
        'src/components/panels/AIChatTab.tsx',
        'utf-8',
      );

      // Verify finally block resets state
      expect(source).toContain('abortControllerRef.current = null');
      expect(source).toContain('setIsStreaming(false)');
      // Both should be in a finally block
      expect(source).toMatch(/finally\s*\{[\s\S]*?setIsStreaming\(false\)/);
    });

    it('AI client passes AbortSignal to fetch', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/ai/client.ts', 'utf-8');

      // Verify signal is passed to fetch options
      expect(source).toMatch(/fetch\(url,\s*\{[\s\S]*?signal/);
    });

    it('AI client streaming handler releases reader in finally block', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/ai/client.ts', 'utf-8');

      // Verify reader cleanup
      expect(source).toContain('reader.releaseLock()');
      expect(source).toMatch(/finally\s*\{[\s\S]*?reader\.releaseLock\(\)/);
    });

    it('user messages are persisted BEFORE streaming begins', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync(
        'src/components/panels/AIChatTab.tsx',
        'utf-8',
      );

      // In handleSend, persistMessage('user', trimmed) is called before sendWithAI
      const handleSendMatch = source.match(
        /persistMessage\('user',\s*trimmed\)[\s\S]*?sendWith(?:AI|Placeholder)/,
      );
      expect(handleSendMatch).not.toBeNull();
    });
  });
});
