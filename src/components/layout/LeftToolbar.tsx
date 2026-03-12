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
} from "lucide-react";
import { useHistoryStore } from "@/store/historyStore";
import { useToolStore } from "@/store/toolStore";
import type { ToolMode } from "@/store/toolStore";

export function LeftToolbar() {
  const activeMode = useToolStore((s) => s.mode);

  const tools: Array<{
    icon: typeof MousePointer2;
    label: string;
    shortcut: string;
    mode?: ToolMode;
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
  ];

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center gap-1 p-2">
        {tools.map(({ icon: Icon, label, shortcut, mode, onClick }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button
                aria-label={`${label} (${shortcut})`}
                className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                  mode && activeMode === mode
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
                onClick={onClick}
              >
                <Icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {label} ({shortcut})
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </ScrollArea>
  );
}
