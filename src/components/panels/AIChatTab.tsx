/**
 * AIChatTab - AI chat interface for the right panel.
 * Shows context indicator with focused node name and neighbor count,
 * message history, text input, and send button.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Send, Bot, User, Info } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { findNode } from '@/core/graph/graphEngine';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function AIChatTab() {
  const graph = useCoreStore((s) => s.graph);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Simulate AI response (placeholder until real API integration)
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: `I understand you're asking about${node ? ` "${node.displayName}"` : ' the architecture'}. AI integration is not yet connected. This is a placeholder response.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  }, [inputValue, node]);

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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" data-testid="ai-messages">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8" data-testid="ai-empty-state">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Ask questions about this node</p>
            <p className="text-xs mt-1">AI will use the selected node and its neighbors as context</p>
          </div>
        ) : (
          messages.map((msg) => (
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
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-gray-600" />
                </div>
              )}
            </div>
          ))
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
            className="flex-1 resize-none text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            data-testid="ai-chat-input"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            title="Send message"
            data-testid="ai-send-button"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
