import { useChatStore } from '@/store/chatStore';

export function ChatProviderSelector() {
  const providers = useChatStore((s) => s.providers);
  const activeProviderId = useChatStore((s) => s.activeProviderId);

  const providerList = Array.from(providers.values());

  if (providerList.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No providers</span>
    );
  }

  return (
    <select
      value={activeProviderId ?? ''}
      onChange={(e) => useChatStore.getState().setActiveProvider(e.target.value)}
      className="rounded border border-border bg-popover px-2 py-0.5 text-xs text-popover-foreground outline-none"
      aria-label="AI provider"
    >
      {providerList.map((p) => (
        <option key={p.id} value={p.id}>
          {p.available ? '\u25CF' : '\u25CB'} {p.displayName}
        </option>
      ))}
    </select>
  );
}
