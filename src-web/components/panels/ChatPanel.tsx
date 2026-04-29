import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Settings, Trash2 } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import { ChatMessage } from './ChatMessage';
import { ChatProviderSelector } from './ChatProviderSelector';
import { AnimatedBanner } from '@/components/ui/animated-banner';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';
import { duration, entrance, bannerTransition, withReducedMotion } from '@/lib/motion';

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

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefersReduced = useReducedMotion();

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
  const canSend = !isStreaming && !!activeProvider?.available && input.trim().length > 0;

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
          <button
            onClick={() => useUiStore.getState().openAiSettingsDialog()}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="AI settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => useChatStore.getState().clearHistory()}
            disabled={isStreaming}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            aria-label="Clear history"
            title="Clear conversation history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
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
      <AnimatedBanner visible={!!error} variant="error">
        {error}
      </AnimatedBanner>

      {/* Warning banner (rate-limit etc.) -- hidden when error is showing */}
      <AnimatedBanner visible={!!warning && !error} variant="warning">
        {warning}
      </AnimatedBanner>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <motion.p
            className="text-center text-xs text-muted-foreground pt-8"
            {...withReducedMotion(prefersReduced, entrance.fadeUp)}
          >
            No messages yet. Type below to start a conversation.
          </motion.p>
        )}
        {messages.map((msg, idx) => (
          <ChatMessage key={`${msg.role}-${msg.timestamp}-${idx}`} message={msg} />
        ))}

        {/* Streaming indicator with message skeleton */}
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              key="streaming-indicator"
              className="space-y-2 text-xs text-muted-foreground"
              initial={prefersReduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0 }}
              transition={bannerTransition}
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent-foreground" />
                <span>{statusMessage ?? 'AI is responding...'}</span>
              </div>
              <SkeletonLoader count={3} />
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="border-t border-border p-2">
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
            disabled={isStreaming || !activeProvider?.available}
            rows={1}
            className="flex-1 resize-none rounded border border-border bg-input px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring disabled:opacity-50"
            aria-label="Chat input"
          />
          <AnimatePresence mode="wait">
            {isStreaming ? (
              <motion.button
                key="stop-btn"
                onClick={handleInterrupt}
                className="shrink-0 rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/80"
                aria-label="Stop"
                initial={prefersReduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0 }}
                transition={{ duration: duration.normal }}
              >
                Stop
              </motion.button>
            ) : (
              <motion.button
                key="send-btn"
                onClick={handleSend}
                disabled={!canSend}
                className="shrink-0 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
                aria-label="Send message"
                initial={prefersReduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0 }}
                transition={{ duration: duration.normal }}
              >
                Send
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
