/**
 * Tests for Feature #174: AI message history persisted in .archc file.
 * Verifies that AI conversations are saved and restored when opening/saving files.
 *
 * Steps:
 * 1. Send several messages in AI chat
 * 2. Save the file (convert to proto)
 * 3. Close and reopen the file (decode from proto)
 * 4. Verify previous messages are restored
 * 5. Verify message order is preserved
 * 6. Verify both user and AI messages appear
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from '@/store/aiStore';
import { graphToProto, protoToGraphFull } from '@/core/storage/fileIO';
import type { ArchGraph } from '@/types/graph';
import type { AIConversation, AIMessage } from '@/types/ai';

// Helper to create a simple test graph
function createTestGraph(): ArchGraph {
  return {
    name: 'Test Architecture',
    description: 'For AI persistence tests',
    owners: [],
    nodes: [],
    edges: [],
  };
}

describe('Feature #174: AI message history persisted in .archc file', () => {
  beforeEach(() => {
    // Reset AI store before each test
    useAIStore.setState({ conversations: [] });
  });

  describe('AI store basic operations', () => {
    it('starts with empty conversations', () => {
      expect(useAIStore.getState().conversations).toEqual([]);
      expect(useAIStore.getState().getMessages()).toEqual([]);
    });

    it('adds a user message and creates global conversation', () => {
      const msg = useAIStore.getState().addMessage('user', 'Hello AI');
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello AI');
      expect(msg.id).toBeTruthy();
      expect(msg.timestampMs).toBeGreaterThan(0);

      const messages = useAIStore.getState().getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello AI');
    });

    it('adds multiple messages in order', () => {
      useAIStore.getState().addMessage('user', 'First message');
      useAIStore.getState().addMessage('assistant', 'First response');
      useAIStore.getState().addMessage('user', 'Second message');

      const messages = useAIStore.getState().getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[0].role).toBe('user');
      expect(messages[1].content).toBe('First response');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].content).toBe('Second message');
      expect(messages[2].role).toBe('user');
    });

    it('clearConversations removes all messages', () => {
      useAIStore.getState().addMessage('user', 'Hello');
      useAIStore.getState().addMessage('assistant', 'Hi there');
      expect(useAIStore.getState().getMessages()).toHaveLength(2);

      useAIStore.getState().clearConversations();
      expect(useAIStore.getState().conversations).toEqual([]);
      expect(useAIStore.getState().getMessages()).toEqual([]);
    });

    it('setConversations restores conversations from data', () => {
      const conversations: AIConversation[] = [
        {
          id: 'conv-1',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Restored message',
              timestampMs: 1000,
              suggestions: [],
            },
            {
              id: 'msg-2',
              role: 'assistant',
              content: 'Restored response',
              timestampMs: 2000,
              suggestions: [],
            },
          ],
          createdAtMs: 1000,
        },
      ];

      useAIStore.getState().setConversations(conversations);
      const messages = useAIStore.getState().getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Restored message');
      expect(messages[1].content).toBe('Restored response');
    });
  });

  describe('AI state serialization (save/load round-trip)', () => {
    it('persists AI messages through graphToProto → protoToGraphFull round-trip', () => {
      const graph = createTestGraph();

      // Create conversations with messages
      const aiState = {
        conversations: [
          {
            id: 'conv-test-1',
            messages: [
              {
                id: 'msg-user-1',
                role: 'user' as const,
                content: 'What is this architecture?',
                timestampMs: 1000,
                suggestions: [],
              },
              {
                id: 'msg-ai-1',
                role: 'assistant' as const,
                content: 'This is a microservices architecture.',
                timestampMs: 2000,
                suggestions: [],
              },
              {
                id: 'msg-user-2',
                role: 'user' as const,
                content: 'How many services?',
                timestampMs: 3000,
                suggestions: [],
              },
              {
                id: 'msg-ai-2',
                role: 'assistant' as const,
                content: 'There are 5 services.',
                timestampMs: 4000,
                suggestions: [],
              },
            ],
            createdAtMs: 1000,
          },
        ],
      };

      // Serialize to proto
      const protoFile = graphToProto(graph, undefined, undefined, aiState);

      // Verify proto has aiState
      expect(protoFile.aiState).toBeTruthy();
      expect(protoFile.aiState!.conversations).toHaveLength(1);
      expect(protoFile.aiState!.conversations![0].messages).toHaveLength(4);

      // Deserialize back
      const result = protoToGraphFull(protoFile);
      expect(result.aiState).toBeTruthy();
      expect(result.aiState!.conversations).toHaveLength(1);

      const restoredConv = result.aiState!.conversations[0];
      expect(restoredConv.id).toBe('conv-test-1');
      expect(restoredConv.createdAtMs).toBe(1000);
      expect(restoredConv.messages).toHaveLength(4);

      // Verify message order is preserved
      expect(restoredConv.messages[0].role).toBe('user');
      expect(restoredConv.messages[0].content).toBe('What is this architecture?');
      expect(restoredConv.messages[1].role).toBe('assistant');
      expect(restoredConv.messages[1].content).toBe('This is a microservices architecture.');
      expect(restoredConv.messages[2].role).toBe('user');
      expect(restoredConv.messages[2].content).toBe('How many services?');
      expect(restoredConv.messages[3].role).toBe('assistant');
      expect(restoredConv.messages[3].content).toBe('There are 5 services.');
    });

    it('preserves message timestamps', () => {
      const graph = createTestGraph();
      const aiState = {
        conversations: [
          {
            id: 'conv-1',
            messages: [
              {
                id: 'msg-1',
                role: 'user' as const,
                content: 'Hello',
                timestampMs: 1709312400000,
                suggestions: [],
              },
            ],
            createdAtMs: 1709312400000,
          },
        ],
      };

      const protoFile = graphToProto(graph, undefined, undefined, aiState);
      const result = protoToGraphFull(protoFile);

      expect(result.aiState!.conversations[0].messages[0].timestampMs).toBe(1709312400000);
      expect(result.aiState!.conversations[0].createdAtMs).toBe(1709312400000);
    });

    it('handles empty AI state (no conversations)', () => {
      const graph = createTestGraph();

      // No AI state passed
      const protoFile = graphToProto(graph);
      const result = protoToGraphFull(protoFile);

      // Should have no AI state
      expect(result.aiState).toBeUndefined();
    });

    it('handles conversation with empty messages', () => {
      const graph = createTestGraph();
      const aiState = {
        conversations: [
          {
            id: 'conv-empty',
            messages: [],
            createdAtMs: 1000,
          },
        ],
      };

      const protoFile = graphToProto(graph, undefined, undefined, aiState);
      const result = protoToGraphFull(protoFile);

      expect(result.aiState!.conversations).toHaveLength(1);
      expect(result.aiState!.conversations[0].messages).toHaveLength(0);
    });

    it('preserves message IDs through round-trip', () => {
      const graph = createTestGraph();
      const aiState = {
        conversations: [
          {
            id: 'conv-id-test',
            messages: [
              {
                id: 'unique-msg-id-1',
                role: 'user' as const,
                content: 'Test',
                timestampMs: 1000,
                suggestions: [],
              },
              {
                id: 'unique-msg-id-2',
                role: 'assistant' as const,
                content: 'Reply',
                timestampMs: 2000,
                suggestions: [],
              },
            ],
            createdAtMs: 1000,
          },
        ],
      };

      const protoFile = graphToProto(graph, undefined, undefined, aiState);
      const result = protoToGraphFull(protoFile);

      expect(result.aiState!.conversations[0].messages[0].id).toBe('unique-msg-id-1');
      expect(result.aiState!.conversations[0].messages[1].id).toBe('unique-msg-id-2');
    });

    it('both user and assistant messages persist correctly', () => {
      const graph = createTestGraph();
      const aiState = {
        conversations: [
          {
            id: 'conv-roles',
            messages: [
              {
                id: 'msg-u',
                role: 'user' as const,
                content: 'User says hello',
                timestampMs: 1000,
                suggestions: [],
              },
              {
                id: 'msg-a',
                role: 'assistant' as const,
                content: 'AI responds',
                timestampMs: 2000,
                suggestions: [],
              },
            ],
            createdAtMs: 1000,
          },
        ],
      };

      const protoFile = graphToProto(graph, undefined, undefined, aiState);
      const result = protoToGraphFull(protoFile);

      const msgs = result.aiState!.conversations[0].messages;
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('User says hello');
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].content).toBe('AI responds');
    });

    it('preserves multiple conversations', () => {
      const graph = createTestGraph();
      const aiState = {
        conversations: [
          {
            id: 'conv-global',
            messages: [
              {
                id: 'g1',
                role: 'user' as const,
                content: 'Global question',
                timestampMs: 1000,
                suggestions: [],
              },
            ],
            createdAtMs: 1000,
          },
          {
            id: 'conv-scoped',
            scopedToNodeId: 'node-123',
            messages: [
              {
                id: 's1',
                role: 'user' as const,
                content: 'Node-scoped question',
                timestampMs: 2000,
                suggestions: [],
              },
            ],
            createdAtMs: 2000,
          },
        ],
      };

      const protoFile = graphToProto(graph, undefined, undefined, aiState);
      const result = protoToGraphFull(protoFile);

      expect(result.aiState!.conversations).toHaveLength(2);
      expect(result.aiState!.conversations[0].id).toBe('conv-global');
      expect(result.aiState!.conversations[1].id).toBe('conv-scoped');
      expect(result.aiState!.conversations[1].scopedToNodeId).toBe('node-123');
    });
  });

  describe('End-to-end: store → save → load → store', () => {
    it('round-trips messages from AI store through file format', () => {
      const graph = createTestGraph();

      // Step 1: Send several messages in AI chat (add to store)
      useAIStore.getState().addMessage('user', 'What does this system do?');
      useAIStore.getState().addMessage('assistant', 'This system handles order processing.');
      useAIStore.getState().addMessage('user', 'Can you explain the data flow?');
      useAIStore
        .getState()
        .addMessage('assistant', 'Data flows from API Gateway to Order Service to Database.');

      // Step 2: Save the file (get AI state from store)
      const conversations = useAIStore.getState().conversations;
      expect(conversations).toHaveLength(1);
      expect(conversations[0].messages).toHaveLength(4);

      const aiState = { conversations };
      const protoFile = graphToProto(graph, undefined, undefined, aiState);

      // Step 3: "Close" the file (clear store)
      useAIStore.getState().clearConversations();
      expect(useAIStore.getState().getMessages()).toHaveLength(0);

      // Step 4: "Reopen" the file (load and restore)
      const result = protoToGraphFull(protoFile);
      expect(result.aiState).toBeTruthy();

      // Restore to store
      useAIStore.getState().setConversations(result.aiState!.conversations);

      // Step 5: Verify previous messages are restored
      const restoredMessages = useAIStore.getState().getMessages();
      expect(restoredMessages).toHaveLength(4);

      // Step 6: Verify message order is preserved
      expect(restoredMessages[0].content).toBe('What does this system do?');
      expect(restoredMessages[1].content).toBe('This system handles order processing.');
      expect(restoredMessages[2].content).toBe('Can you explain the data flow?');
      expect(restoredMessages[3].content).toBe(
        'Data flows from API Gateway to Order Service to Database.',
      );

      // Step 7: Verify both user and AI messages appear
      expect(restoredMessages[0].role).toBe('user');
      expect(restoredMessages[1].role).toBe('assistant');
      expect(restoredMessages[2].role).toBe('user');
      expect(restoredMessages[3].role).toBe('assistant');
    });
  });
});
