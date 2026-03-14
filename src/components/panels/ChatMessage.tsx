import { useState } from 'react';
import type {
  ChatMessage as ChatMessageType,
  ChatEvent,
  ToolCallEvent,
  ToolResultEvent,
  AskUserQuestionEvent,
  PermissionRequestEvent,
  StatusEvent,
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
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Events renderer
// ---------------------------------------------------------------------------

function EventsList({ events }: { events: ChatEvent[] }) {
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
          case 'thinking':
            return <ThinkingBlock key={`think-${idx}`} content={ev.content} />;
          case 'status':
            return <StatusLine key={`status-${idx}`} message={(ev as StatusEvent).message} />;
          case 'rate_limit':
            return <RateLimitBadge key={`ratelimit-${idx}`} message={(ev as RateLimitEvent).message} />;
          // text, tool_result, done, error — not rendered as standalone blocks
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

  return (
    <div className="my-1 text-xs text-muted-foreground">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 hover:text-foreground"
        aria-expanded={expanded}
      >
        <span>{expanded ? '\u25BC' : '\u25B6'}</span>
        <span className="italic">Thinking...</span>
      </button>
      {expanded && (
        <p className="mt-0.5 whitespace-pre-wrap pl-4 text-[11px] opacity-70">
          {content}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status line (dimmed, with subtle spinner)
// ---------------------------------------------------------------------------

function StatusLine({ message }: { message: string }) {
  return (
    <div className="my-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="inline-block h-2 w-2 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
      <span className="italic">{message}</span>
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
