import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MousePointer2,
  Hand,
  Square,
  Cable,
  Search,
  Undo2,
  Redo2,
  LayoutGrid,
  MessageSquare,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useHistoryStore } from "@/store/historyStore";
import { useToolStore } from "@/store/toolStore";
import type { ToolMode } from "@/store/toolStore";
import { useUiStore } from "@/store/uiStore";
import { useThemeStore } from "@/store/themeStore";

export function LeftToolbar() {
  const activeMode = useToolStore((s) => s.mode);
  const rightPanelMode = useUiStore((s) => s.rightPanelMode);
  const themeMode = useThemeStore((s) => s.mode);
  const resolvedMode = useThemeStore((s) => s.getResolvedMode());
  const themeIcon = themeMode === 'system' ? Monitor : resolvedMode === 'dark' ? Moon : Sun;
  const themeLabel = themeMode === 'system' ? 'System (auto)' : themeMode === 'dark' ? 'Dark mode' : 'Light mode';

  const tools: Array<{
    icon: typeof MousePointer2;
    label: string;
    shortcut: string;
    mode?: ToolMode;
    active?: boolean;
    onClick?: () => void;
  }> = [
    {
      icon: MousePointer2,
      label: "Select",
      shortcut: "V",
      mode: 'select',
      onClick: () => useToolStore.getState().setMode('select'),
    },
    {
      icon: Hand,
      label: "Pan",
      shortcut: "H",
      mode: 'pan',
      onClick: () => useToolStore.getState().setMode('pan'),
    },
    {
      icon: Square,
      label: "Add Node",
      shortcut: "N",
      onClick: () => window.dispatchEvent(new CustomEvent('archcanvas:open-palette', { detail: { prefix: '@' } })),
    },
    {
      icon: Cable,
      label: "Connect",
      shortcut: "C",
      mode: 'connect',
      onClick: () => useToolStore.getState().setMode('connect'),
    },
    {
      icon: Search,
      label: "Search",
      shortcut: "⌘K",
      onClick: () => window.dispatchEvent(new CustomEvent('archcanvas:open-palette')),
    },
    {
      icon: LayoutGrid,
      label: "Auto Layout",
      shortcut: "⌘⇧L",
      onClick: () => window.dispatchEvent(new CustomEvent('archcanvas:auto-layout')),
    },
    {
      icon: Undo2,
      label: "Undo",
      shortcut: "⌘Z",
      onClick: () => useHistoryStore.getState().undo(),
    },
    {
      icon: Redo2,
      label: "Redo",
      shortcut: "⇧⌘Z",
      onClick: () => useHistoryStore.getState().redo(),
    },
    {
      icon: MessageSquare,
      label: "AI Chat",
      shortcut: "⌘⇧I",
      active: rightPanelMode === 'chat',
      onClick: () => useUiStore.getState().toggleChat(),
    },
    {
      icon: themeIcon,
      label: themeLabel,
      shortcut: '',
      onClick: () => {
        const { mode, setMode } = useThemeStore.getState();
        const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
        setMode(next);
      },
    },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center gap-1 p-2">
        {tools.map(({ icon: Icon, label, shortcut, mode, active, onClick }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button
                aria-label={shortcut ? `${label} (${shortcut})` : label}
                data-active={active || (mode && activeMode === mode) ? "true" : undefined}
                className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground'
                    : mode && activeMode === mode
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
                onClick={onClick}
              >
                <Icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {shortcut ? `${label} (${shortcut})` : label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </ScrollArea>
  );
}
