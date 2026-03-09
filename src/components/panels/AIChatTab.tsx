/**
 * AIChatTab - AI chat interface for the right panel.
 * Shows context indicator with focused node name and neighbor count,
 * message history, text input, and send button.
 * Uses placeholder responses (Anthropic SDK has been removed).
 * Messages are kept in local React state (AI Zustand store has been removed).
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Send, Bot, User, Info, Loader2, Sparkles, Check } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { findNode } from '@/core/graph/graphEngine';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export function AIChatTab() {
  const graph = useCoreStore((s) => s.graph);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);

  // Messages are now local React state (AI store removed)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Local UI state for streaming
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [appliedMessageIds, setAppliedMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive display messages: local messages + any in-progress streaming message
  const messages: ChatMessage[] = useMemo(() => {
    if (streamingMessage) {
      return [...chatMessages, streamingMessage];
    }
    return chatMessages;
  }, [chatMessages, streamingMessage]);

  // Get the focused node
  const node = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNode(graph, selectedNodeId);
  }, [graph, selectedNodeId]);

  // Count unique neighbor nodes connected to the selected node
  const neighborCount = useMemo(() => {
    if (!selectedNodeId) return 0;
    const neighborIds = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.fromNode === selectedNodeId) {
        neighborIds.add(edge.toNode);
      } else if (edge.toNode === selectedNodeId) {
        neighborIds.add(edge.fromNode);
      }
    }
    return neighborIds.size;
  }, [graph, selectedNodeId]);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear messages and streaming state when switching nodes
  useEffect(() => {
    setChatMessages([]);
    setStreamingMessage(null);
    setInputValue('');
    setAppliedMessageIds(new Set());
  }, [selectedNodeId]);

  const suggest = useCoreStore((s) => s.suggest);

  /** Apply an AI suggestion: creates a pending note on the selected node */
  const handleApply = useCallback(
    (messageId: string, content: string) => {
      if (!selectedNodeId || !content) return;
      suggest({
        nodeId: selectedNodeId,
        content: content.slice(0, 200),
        suggestionType: 'general',
      });
      setAppliedMessageIds((prev) => new Set(prev).add(messageId));
    },
    [selectedNodeId, suggest],
  );

  /** Add a message to local state */
  const addMessage = useCallback(
    (role: 'user' | 'assistant', content: string): ChatMessage => {
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${role}`,
        role,
        content,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, msg]);
      return msg;
    },
    [],
  );

  /**
   * Send with placeholder response (Anthropic SDK removed).
   */
  const sendWithPlaceholder = useCallback(
    (_userContent: string) => {
      const assistantMsgId = `msg-${Date.now()}-assistant`;

      // Create streaming placeholder
      setStreamingMessage({
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      });

      // Simulate streaming with character-by-character reveal
      const fullResponse = node
        ? `I understand you're asking about "${node.displayName}". AI responses require an external AI agent connected via MCP.`
        : `AI-powered architecture analysis requires an external AI agent connected via MCP.`;

      let charIndex = 0;
      const interval = setInterval(() => {
        charIndex += 2; // Reveal 2 chars at a time for visible streaming effect
        if (charIndex >= fullResponse.length) {
          clearInterval(interval);
          // Add the completed assistant message to local state
          addMessage('assistant', fullResponse);
          setStreamingMessage(null);
          setIsStreaming(false);
        } else {
          setStreamingMessage((prev) =>
            prev ? { ...prev, content: fullResponse.slice(0, charIndex) } : null,
          );
        }
      }, 20);
    },
    [node, addMessage],
  );

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    // Add user message to local state
    addMessage('user', trimmed);

    setInputValue('');
    setIsStreaming(true);

    sendWithPlaceholder(trimmed);
  }, [inputValue, isStreaming, sendWithPlaceholder, addMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col h-full" data-testid="aichat-tab">
      {/* Context indicator */}
      <div
        className="px-3 py-2 bg-blue-50 border-b border-blue-100 rounded-t"
        data-testid="ai-context-indicator"
      >
        <div className="flex items-center gap-1.5 text-xs text-blue-700">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Context:</span>
          <span data-testid="ai-context-node-name">
            {node ? node.displayName : 'No node selected'}
          </span>
        </div>
        <div
          className="text-[11px] text-blue-500 mt-0.5 ml-5"
          data-testid="ai-context-neighbor-count"
        >
          {node
            ? neighborCount === 0
              ? 'No connections'
              : `${neighborCount} neighbor${neighborCount === 1 ? '' : 's'} in context`
            : 'Select a node to provide context'}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" data-testid="ai-messages">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8" data-testid="ai-empty-state">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Ask questions about this node</p>
            <p className="text-xs mt-1">
              AI will use the selected node and its neighbors as context
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={`ai-message-${msg.role}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === 'assistant' ? '' : ''}`}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                    {msg.isStreaming && (
                      <span
                        className="inline-block ml-1 animate-pulse"
                        data-testid="ai-streaming-indicator"
                      >
                        <Loader2 className="w-3 h-3 inline animate-spin" />
                      </span>
                    )}
                  </div>
                  {/* Apply button for completed assistant messages when a node is selected */}
                  {msg.role === 'assistant' && !msg.isStreaming && selectedNodeId && msg.content && (
                    <div className="mt-1">
                      {appliedMessageIds.has(msg.id) ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-green-600 px-2 py-0.5"
                          data-testid="ai-suggestion-applied"
                        >
                          <Check className="w-3 h-3" />
                          Applied as note
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApply(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-0.5 rounded transition-colors"
                          title="Apply as pending note on this node"
                          data-testid="ai-apply-suggestion"
                        >
                          <Sparkles className="w-3 h-3" />
                          Apply
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-gray-600" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-2" data-testid="ai-input-area">
        <div className="flex items-end gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={node ? `Ask about ${node.displayName}...` : 'Select a node first...'}
            rows={2}
            disabled={isStreaming}
            aria-label="Chat message"
            className="flex-1 resize-none text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="ai-chat-input"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            title="Send message"
            data-testid="ai-send-button"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
