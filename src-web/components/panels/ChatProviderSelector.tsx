import { ChevronDownIcon } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export function ChatProviderSelector() {
  const providers = useChatStore((s) => s.providers);
  const activeProviderId = useChatStore((s) => s.activeProviderId);

  const providerList = Array.from(providers.values());

  if (providerList.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No providers</span>
    );
  }

  const activeProvider = activeProviderId
    ? providers.get(activeProviderId)
    : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded border border-border bg-popover px-2 py-0.5 text-xs text-popover-foreground outline-none"
          aria-label="AI provider"
          data-connected={activeProvider?.available ? 'true' : undefined}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              activeProvider?.available ? 'bg-green-500' : 'bg-muted-foreground'
            }`}
          />
          <span>{activeProvider?.displayName ?? 'Select provider'}</span>
          <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {providerList.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => {
              if (!p.available && p.id === 'claude-api-key') {
                useChatStore.getState().setActiveProvider(p.id);
                useUiStore.getState().openAiSettingsDialog();
                return;
              }
              useChatStore.getState().setActiveProvider(p.id);
            }}
            className="gap-2 text-xs"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                p.available ? 'bg-green-500' : 'bg-muted-foreground'
              }`}
            />
            <span>{p.displayName}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
