import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type {
  ChatMessage as ChatMessageType,
  ChatEvent,
  ToolCallEvent,
  ToolResultEvent,
  AskUserQuestionEvent,
  PermissionRequestEvent,
  RateLimitEvent,
} from '@/core/ai/types';
import { ChatToolCall } from './ChatToolCall';
import { ChatPermissionCard } from './ChatPermissionCard';
import { ChatQuestionCard } from './ChatQuestionCard';

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  const prefersReduced = useReducedMotion();
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const slideX = isUser ? 20 : -20;

  return (
    <motion.div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={prefersReduced ? false : { opacity: 0, x: slideX }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-accent text-accent-foreground'
            : 'bg-card text-card-foreground'
        }`}
      >
        {/* Text content */}
        {message.content && (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}

        {/* Events (assistant only) */}
        {!isUser && message.events && message.events.length > 0 && (
          <EventsList events={message.events} />
        )}

        {/* Timestamp */}
        <p
          className={`mt-1 text-[10px] ${
            isUser ? 'text-accent-foreground/60' : 'text-muted-foreground'
          }`}
        >
          {time}
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Events renderer
// ---------------------------------------------------------------------------

function EventsList({ events }: { events: ChatEvent[] }) {
  // Merge all thinking events into a single collapsible block
  let thinkingContent = '';
  for (const ev of events) {
    if (ev.type === 'thinking') {
      thinkingContent += ev.content;
    }
  }

  // Build a map of tool_result events keyed by their id, so we can pair them
  // with tool_call events.
  const resultMap = new Map<string, ToolResultEvent>();
  for (const ev of events) {
    if (ev.type === 'tool_result') {
      resultMap.set(ev.id, ev);
    }
  }

  return (
    <div className="mt-1.5 space-y-1">
      {/* Single thinking block for all thinking in this message */}
      {thinkingContent && <ThinkingBlock content={thinkingContent} />}
      {events.map((ev, idx) => {
        switch (ev.type) {
          case 'tool_call':
            return (
              <ChatToolCall
                key={`tool-${ev.id}-${idx}`}
                event={ev as ToolCallEvent}
                result={resultMap.get(ev.id)}
              />
            );
          case 'permission_request':
            return (
              <ChatPermissionCard
                key={`perm-${ev.id}-${idx}`}
                id={ev.id}
                tool={ev.tool}
                command={ev.command}
                blockedPath={(ev as PermissionRequestEvent).blockedPath}
                decisionReason={(ev as PermissionRequestEvent).decisionReason}
                permissionSuggestions={(ev as PermissionRequestEvent).permissionSuggestions}
              />
            );
          case 'ask_user_question':
            return (
              <ChatQuestionCard
                key={`q-${(ev as AskUserQuestionEvent).id}-${idx}`}
                id={(ev as AskUserQuestionEvent).id}
                questions={(ev as AskUserQuestionEvent).questions}
              />
            );
          case 'rate_limit':
            return <RateLimitBadge key={`ratelimit-${idx}`} message={(ev as RateLimitEvent).message} />;
          // thinking -- rendered as merged block above
          // status -- shown in the streaming indicator, not duplicated here
          // text, tool_result, done, error -- not rendered as standalone blocks
          default:
            return null;
        }
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thinking block (collapsible, dimmed)
// ---------------------------------------------------------------------------

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const prefersReduced = useReducedMotion();

  return (
    <div className="my-1 text-xs text-muted-foreground">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 hover:text-foreground"
        aria-expanded={expanded}
      >
        <motion.span
          className="inline-block"
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
        >
          {'\u25BC'}
        </motion.span>
        <span className="italic">Thinking...</span>
      </button>
      {expanded && (
        <motion.p
          className="mt-0.5 whitespace-pre-wrap pl-4 text-[11px] opacity-70"
          initial={prefersReduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 0.7 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {content}
        </motion.p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate limit warning badge (yellow)
// ---------------------------------------------------------------------------

function RateLimitBadge({ message }: { message: string }) {
  return (
    <div className="my-0.5 inline-flex items-center gap-1 rounded-sm bg-yellow-900/40 px-1.5 py-0.5 text-[11px] text-yellow-300">
      <span aria-hidden="true">&#x26A0;</span>
      <span>{message}</span>
    </div>
  );
}
