import { Wrench, MessageSquare, Waves } from 'lucide-react';

/**
 * Effective capabilities for the currently selected provider+model — the
 * caller computes this as `{ tools: provider.supportsTools(),
 * streaming: provider.capabilities.streaming }` (task 11 / spec §3.4).
 * `supportsTools()` is the dynamic, currently-selected-model check (it can
 * differ from the provider's static `capabilities.tools`), so badges track
 * the actual model, not just the provider family.
 */
export interface EffectiveCapabilities {
  tools: boolean;
  streaming: boolean;
}

const badgeBase =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium';

/**
 * Pure presentational badge list — does not call `supportsTools()` itself,
 * it only renders the `{ tools, streaming }` value it's given.
 */
export function CapabilityBadge({ tools, streaming }: EffectiveCapabilities) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="capability-badge">
      {tools ? (
        <span className={`${badgeBase} border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400`}>
          <Wrench className="size-3" />
          Tools
        </span>
      ) : (
        <span className={`${badgeBase} border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400`}>
          <MessageSquare className="size-3" />
          Conversation-only
        </span>
      )}
      {streaming && (
        <span className={`${badgeBase} border-border bg-surface text-muted-foreground`}>
          <Waves className="size-3" />
          Streaming
        </span>
      )}
    </div>
  );
}
