import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useFileStore } from '@/store/fileStore';
import { ChatMessage } from './ChatMessage';
import { ChatProviderSelector } from './ChatProviderSelector';

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const warning = useChatStore((s) => s.warning);
  const statusMessage = useChatStore((s) => s.statusMessage);
  const providers = useChatStore((s) => s.providers);
  const activeProviderId = useChatStore((s) => s.activeProviderId);
  const permissionMode = useChatStore((s) => s.permissionMode);
  const effort = useChatStore((s) => s.effort);

  const projectPath = useFileStore((s) => s.projectPath);
  const [pathInput, setPathInput] = useState('');

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // scrollIntoView may not exist in test environments (jsdom)
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-focus textarea when panel mounts or when chat is opened
  useEffect(() => {
    // Focus on initial mount
    requestAnimationFrame(() => textareaRef.current?.focus());
    // Also focus when chat is (re-)opened while already mounted (e.g. panel collapsed then expanded)
    const handler = () => requestAnimationFrame(() => textareaRef.current?.focus());
    window.addEventListener('archcanvas:focus-chat', handler);
    return () => window.removeEventListener('archcanvas:focus-chat', handler);
  }, []);

  // Escape to interrupt — window-level capture handler because the textarea
  // is disabled during streaming and can't receive onKeyDown events
  useEffect(() => {
    if (!isStreaming) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        useChatStore.getState().interrupt();
      }
    };
    window.addEventListener('keydown', handler, true); // capture phase
    return () => window.removeEventListener('keydown', handler, true);
  }, [isStreaming]);

  const activeProvider = activeProviderId
    ? providers.get(activeProviderId)
    : undefined;
  const needsPath = !projectPath && !!activeProvider?.available;
  const canSend = !isStreaming && !!activeProvider?.available && input.trim().length > 0 && !needsPath;

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !canSend) return;
    setInput('');
    useChatStore.getState().sendMessage(trimmed);
  }, [input, canSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Escape to stop streaming
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault();
      handleInterrupt();
    }
  };

  const handleClose = () => {
    window.dispatchEvent(new CustomEvent('archcanvas:toggle-chat'));
  };

  const handleInterrupt = () => {
    useChatStore.getState().interrupt();
  };

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-sm font-medium">AI Chat</h3>
        <div className="flex items-center gap-2">
          <ChatProviderSelector />
          <select
            value={permissionMode}
            onChange={(e) => useChatStore.getState().setPermissionMode(e.target.value)}
            disabled={isStreaming}
            className="rounded border border-border bg-popover px-2 py-0.5 text-xs text-popover-foreground outline-none disabled:opacity-50"
            aria-label="Permission mode"
          >
            <option value="default">Default</option>
            <option value="acceptEdits">Auto-edit</option>
            <option value="plan">Plan only</option>
            <option value="dontAsk">Strict</option>
          </select>
          <select
            value={effort}
            onChange={(e) => useChatStore.getState().setEffort(e.target.value)}
            disabled={isStreaming}
            className="rounded border border-border bg-popover px-2 py-0.5 text-xs text-popover-foreground outline-none disabled:opacity-50"
            aria-label="Effort level"
          >
            <option value="low">Quick</option>
            <option value="medium">Medium</option>
            <option value="high">Thorough</option>
            <option value="max">Maximum</option>
          </select>
          <button
            onClick={handleClose}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Close chat"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-b border-red-800 bg-red-950/50 px-3 py-1.5 text-xs text-red-300" role="alert">
          {error}
        </div>
      )}

      {/* Warning banner (rate-limit etc.) — hidden when error is showing */}
      {warning && !error && (
        <div className="border-b border-amber-800 bg-amber-950/50 px-3 py-1.5 text-xs text-amber-300" role="status">
          {warning}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground pt-8">
            No messages yet. Type below to start a conversation.
          </p>
        )}
        {messages.map((msg, idx) => (
          <ChatMessage key={`${msg.role}-${msg.timestamp}-${idx}`} message={msg} />
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent-foreground" />
            <span>{statusMessage ?? 'AI is responding...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="border-t border-border p-2">
        {/* Inline path input — shown when projectPath is null and provider is connected */}
        {needsPath && (
          <div className="mb-2 flex gap-2" data-testid="path-input-bar">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pathInput.trim()) {
                  useFileStore.getState().setProjectPath(pathInput.trim());
                }
              }}
              placeholder="/Users/you/projects/my-app"
              className="flex-1 rounded border border-border bg-input px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              aria-label="Project path"
            />
            <button
              onClick={() => {
                if (pathInput.trim()) {
                  useFileStore.getState().setProjectPath(pathInput.trim());
                }
              }}
              disabled={!pathInput.trim()}
              className="shrink-0 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              Set
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeProvider?.available
                ? 'Type a message... (Enter to send)'
                : 'Waiting for AI connection...'
            }
            disabled={isStreaming || !activeProvider?.available || needsPath}
            rows={1}
            className="flex-1 resize-none rounded border border-border bg-input px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring disabled:opacity-50"
            aria-label="Chat input"
          />
          {isStreaming ? (
            <button
              onClick={handleInterrupt}
              className="shrink-0 rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/80"
              aria-label="Stop"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="shrink-0 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
              aria-label="Send message"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
