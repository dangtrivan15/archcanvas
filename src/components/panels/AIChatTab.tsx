/**
 * AIChatTab - AI chat interface for the right panel.
 * Shows context indicator with focused node name and neighbor count,
 * message history, text input, and send button.
 * Integrates with Anthropic Claude API for real responses with streaming.
 * Falls back to placeholder responses when API key is not configured.
 * Messages are persisted via AI store → .archc file.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Send, Bot, User, Info, Loader2, Sparkles, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useAIStore } from '@/store/aiStore';
import { findNode } from '@/core/graph/graphEngine';
import { sendMessage as sendAIMessage, AIClientError } from '@/ai/client';
import { isAIConfigured } from '@/ai/config';

/**
 * Convert an AI API error into a user-friendly message.
 * Maps common error types and status codes to helpful, actionable text.
 */
function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof AIClientError) {
    const { statusCode, errorType } = error;

    // API key issues
    if (error.message.includes('API key not configured')) {
      return 'AI is not configured. Please set your VITE_ANTHROPIC_API_KEY environment variable.';
    }
    if (statusCode === 401 || errorType === 'authentication_error') {
      return 'Invalid API key. Please check your VITE_ANTHROPIC_API_KEY setting.';
    }

    // Rate limiting
    if (statusCode === 429 || errorType === 'rate_limit_error') {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }

    // Overloaded
    if (statusCode === 529 || errorType === 'overloaded_error') {
      return 'The AI service is currently overloaded. Please try again in a few minutes.';
    }

    // Server errors
    if (statusCode && statusCode >= 500) {
      return 'The AI service is temporarily unavailable. Please try again later.';
    }

    // Bad request (e.g., context too long)
    if (statusCode === 400 || errorType === 'invalid_request_error') {
      return 'The request was too large or invalid. Try shortening your message or starting a new conversation.';
    }

    // Fallback with the original message if it's informative
    return `AI error: ${error.message}`;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  if (error instanceof Error) {
    return `Something went wrong: ${error.message}`;
  }

  return 'An unexpected error occurred. Please try again.';
}

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

  // Persisted messages from AI store (select raw conversations to avoid infinite re-render)
  const conversations = useAIStore((s) => s.conversations);
  const addStoreMessage = useAIStore((s) => s.addMessage);
  const addStoreMessageToNode = useAIStore((s) => s.addMessageToNode);

  // Derive store messages from conversations - scoped to selected node
  const storeMessages = useMemo(() => {
    if (selectedNodeId) {
      // Show node-scoped conversation when a node is selected
      const nodeConv = conversations.find((c) => c.scopedToNodeId === selectedNodeId);
      return nodeConv?.messages ?? [];
    }
    // Fall back to global conversation when no node is selected
    const globalConv = conversations.find((c) => !c.scopedToNodeId);
    return globalConv?.messages ?? [];
  }, [conversations, selectedNodeId]);

  // Local UI state for streaming
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [appliedMessageIds, setAppliedMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track last failed message content for retry capability
  const lastFailedContentRef = useRef<string | null>(null);

  // Derive display messages: persisted + any in-progress streaming message
  const messages: ChatMessage[] = useMemo(() => {
    const persisted: ChatMessage[] = storeMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestampMs,
      isStreaming: false,
    }));
    if (streamingMessage) {
      return [...persisted, streamingMessage];
    }
    return persisted;
  }, [storeMessages, streamingMessage]);

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

  // Clear streaming state and applied tracking when switching nodes
  useEffect(() => {
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

  /** Persist a message to the correct conversation (node-scoped or global) */
  const persistMessage = useCallback(
    (role: 'user' | 'assistant', content: string) => {
      if (selectedNodeId) {
        return addStoreMessageToNode(selectedNodeId, role, content);
      }
      return addStoreMessage(role, content);
    },
    [selectedNodeId, addStoreMessage, addStoreMessageToNode],
  );

  /**
   * Build system prompt with architecture context.
   */
  const buildSystemPrompt = useCallback(() => {
    let context = 'You are an AI architecture assistant for ArchCanvas, a visual architecture design tool. ';
    context += `The architecture "${graph.name || 'Untitled'}" has ${graph.nodes.length} nodes and ${graph.edges.length} edges. `;

    if (node) {
      context += `\n\nThe user is currently focused on node "${node.displayName}" (type: ${node.type}).`;
      if (Object.keys(node.args).length > 0) {
        context += `\nNode args: ${JSON.stringify(node.args)}`;
      }
      if (node.notes && node.notes.length > 0) {
        context += `\nNode has ${node.notes.length} notes.`;
      }
    }

    return context;
  }, [graph, node]);

  /**
   * Send message using real AI client with streaming.
   */
  const sendWithAI = useCallback(
    async (userContent: string, conversationHistory: ChatMessage[]) => {
      const assistantMsgId = `msg-${Date.now()}-assistant`;

      // Create streaming placeholder
      setStreamingMessage({
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const apiMessages = conversationHistory
          .filter((m) => !m.isStreaming)
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await sendAIMessage({
          messages: apiMessages,
          system: buildSystemPrompt(),
          stream: true,
          signal: controller.signal,
          onChunk: (text) => {
            setStreamingMessage((prev) =>
              prev ? { ...prev, content: prev.content + text } : null,
            );
          },
        });

        // Persist the completed assistant message to the store (node-scoped or global)
        persistMessage('assistant', result.content);
        // Clear streaming message and any failed state
        setStreamingMessage(null);
        lastFailedContentRef.current = null;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          setStreamingMessage(null);
          return;
        }

        const friendlyMsg = getUserFriendlyErrorMessage(error);
        console.warn('[AIChatTab] AI API error:', error);
        // Persist the user-friendly error message (prefixed for visual distinction)
        persistMessage('assistant', `⚠ ${friendlyMsg}`);
        setStreamingMessage(null);
        // Store the user content for retry capability
        lastFailedContentRef.current = userContent;
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [buildSystemPrompt, persistMessage],
  );

  /**
   * Send with placeholder response (when API key is not configured).
   */
  const sendWithPlaceholder = useCallback(
    (userContent: string) => {
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
        ? `I understand you're asking about "${node.displayName}". To enable real AI responses, set the VITE_ANTHROPIC_API_KEY environment variable in your .env file.`
        : `To enable AI-powered architecture analysis, set the VITE_ANTHROPIC_API_KEY environment variable in your .env file.`;

      let charIndex = 0;
      const interval = setInterval(() => {
        charIndex += 2; // Reveal 2 chars at a time for visible streaming effect
        if (charIndex >= fullResponse.length) {
          clearInterval(interval);
          // Persist the completed assistant message to the store (node-scoped or global)
          persistMessage('assistant', fullResponse);
          setStreamingMessage(null);
          setIsStreaming(false);
        } else {
          setStreamingMessage((prev) =>
            prev ? { ...prev, content: fullResponse.slice(0, charIndex) } : null,
          );
        }
      }, 20);
    },
    [node, persistMessage],
  );

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    // Persist user message to the AI store (node-scoped or global)
    persistMessage('user', trimmed);

    // Build conversation history for API call (from store + the new user message)
    const allMessages: ChatMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
    // Add new user message to history (it's already in the store, but for the API call we need the full list)
    allMessages.push({
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    });

    setInputValue('');
    setIsStreaming(true);

    if (isAIConfigured()) {
      sendWithAI(trimmed, allMessages);
    } else {
      sendWithPlaceholder(trimmed);
    }
  }, [inputValue, isStreaming, messages, sendWithAI, sendWithPlaceholder, persistMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /**
   * Retry the last failed message. Rebuilds conversation history
   * (filtering out error messages) and re-sends via AI.
   */
  const handleRetry = useCallback(() => {
    const content = lastFailedContentRef.current;
    if (!content || isStreaming || !isAIConfigured()) return;

    // Build conversation history from current messages, filtering out error messages
    const retryHistory: ChatMessage[] = messages
      .filter((m) => !(m.role === 'assistant' && (m.content.startsWith('⚠ ') || m.content.startsWith('Error: '))))
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

    setIsStreaming(true);
    sendWithAI(content, retryHistory);
  }, [isStreaming, messages, sendWithAI]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex flex-col h-full" data-testid="aichat-tab">
      {/* Context indicator */}
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 rounded-t" data-testid="ai-context-indicator">
        <div className="flex items-center gap-1.5 text-xs text-blue-700">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Context:</span>
          <span data-testid="ai-context-node-name">
            {node ? node.displayName : 'No node selected'}
          </span>
        </div>
        <div className="text-[11px] text-blue-500 mt-0.5 ml-5" data-testid="ai-context-neighbor-count">
          {node
            ? neighborCount === 0
              ? 'No connections'
              : `${neighborCount} neighbor${neighborCount === 1 ? '' : 's'} in context`
            : 'Select a node to provide context'}
        </div>
      </div>

      {/* Missing API key banner */}
      {!isAIConfigured() && (
        <div className="mx-3 mt-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg" data-testid="ai-missing-key-banner">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800" data-testid="ai-missing-key-title">
                AI API key not configured
              </p>
              <p className="text-xs text-amber-700 mt-1" data-testid="ai-missing-key-instructions">
                To enable AI-powered analysis, add your Anthropic API key:
              </p>
              <ol className="text-xs text-amber-700 mt-1 ml-4 list-decimal space-y-0.5">
                <li>Create a <code className="bg-amber-100 px-1 rounded">.env</code> file in the project root</li>
                <li>Add: <code className="bg-amber-100 px-1 rounded">VITE_ANTHROPIC_API_KEY=sk-ant-...</code></li>
                <li>Restart the development server</li>
              </ol>
              <p className="text-xs text-amber-600 mt-1.5">
                You can still use the app — AI chat will use placeholder responses.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" data-testid="ai-messages">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8" data-testid="ai-empty-state">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Ask questions about this node</p>
            <p className="text-xs mt-1">AI will use the selected node and its neighbors as context</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isError = msg.role === 'assistant' && (msg.content.startsWith('⚠ ') || msg.content.startsWith('Error: '));
            return (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              data-testid={isError ? 'ai-message-error' : `ai-message-${msg.role}`}
            >
              {msg.role === 'assistant' && (
                isError ? (
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                )
              )}
              <div className={`max-w-[85%] ${msg.role === 'assistant' ? '' : ''}`}>
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : isError
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block ml-1 animate-pulse" data-testid="ai-streaming-indicator">
                      <Loader2 className="w-3 h-3 inline animate-spin" />
                    </span>
                  )}
                </div>
                {/* Apply button for completed assistant messages when a node is selected (not for errors) */}
                {msg.role === 'assistant' && !msg.isStreaming && !isError && selectedNodeId && msg.content && (
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
                {/* Retry button for error messages */}
                {isError && !isStreaming && lastFailedContentRef.current && (
                  <div className="mt-1">
                    <button
                      onClick={handleRetry}
                      className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2 py-0.5 rounded transition-colors"
                      title="Retry sending the last message"
                      data-testid="ai-retry-button"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-gray-600" />
                </div>
              )}
            </div>
          );})
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
