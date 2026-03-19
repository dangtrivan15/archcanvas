import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { ToolCallEvent, ToolResultEvent } from '@/core/ai/types';
import { AutoHeight } from '@/components/ui/auto-height';

interface Props {
  event: ToolCallEvent;
  result?: ToolResultEvent;
}

const springTransition = { type: 'spring' as const, stiffness: 500, damping: 30 };

export function ChatToolCall({ event, result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const prefersReduced = useReducedMotion();

  // Build a short summary of the command args
  const summary = summarizeArgs(event.name, event.args);

  return (
    <div className="my-1 rounded border border-border bg-card text-xs">
      {/* Header -- always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-accent/50"
        aria-expanded={expanded}
      >
        <motion.span
          className="inline-block shrink-0 text-muted-foreground"
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={prefersReduced ? { duration: 0 } : springTransition}
        >
          {'\u25BC'}
        </motion.span>
        <span className="font-medium text-card-foreground">{event.name}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {summary}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <AutoHeight className="border-t border-border px-2 py-1.5 space-y-1.5">
          <div>
            <p className="text-muted-foreground mb-0.5">Arguments:</p>
            <pre className="whitespace-pre-wrap break-all rounded bg-muted p-1.5 text-[11px] font-mono text-foreground">
              {JSON.stringify(event.args, null, 2)}
            </pre>
          </div>
          {result && (
            <div>
              <p className={`mb-0.5 ${result.isError ? 'text-red-400' : 'text-muted-foreground'}`}>
                {result.isError ? 'Error:' : 'Result:'}
              </p>
              <motion.pre
                className={`whitespace-pre-wrap break-all rounded p-1.5 text-[11px] font-mono ${
                  result.isError
                    ? 'bg-red-950/30 text-red-300'
                    : 'bg-muted text-foreground'
                }`}
                animate={
                  result.isError && !prefersReduced
                    ? { x: [0, -3, 3, -3, 0] }
                    : {}
                }
                transition={{ duration: 0.3 }}
              >
                {result.result}
              </motion.pre>
            </div>
          )}
        </AutoHeight>
      )}
    </div>
  );
}

/** Produce a short summary string for the tool call header. */
function summarizeArgs(toolName: string, args: Record<string, unknown>): string {
  // For Bash commands, show the command
  if (toolName === 'Bash' && typeof args.command === 'string') {
    const cmd = args.command;
    return cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd;
  }
  // For other tools, show the first string value
  for (const val of Object.values(args)) {
    if (typeof val === 'string' && val.length > 0) {
      return val.length > 60 ? val.slice(0, 57) + '...' : val;
    }
  }
  return '';
}
