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

export function LeftToolbar() {
  const tools = [
    { icon: MousePointer2, label: "Select", shortcut: "V", onClick: undefined as (() => void) | undefined },
    { icon: Hand, label: "Pan", shortcut: "H", onClick: undefined as (() => void) | undefined },
    {
      icon: Square,
      label: "Add Node",
      shortcut: "N",
      onClick: () => window.dispatchEvent(new CustomEvent('archcanvas:open-palette', { detail: { prefix: '@' } })),
    },
    { icon: Cable, label: "Connect", shortcut: "C", onClick: undefined as (() => void) | undefined },
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
        {tools.map(({ icon: Icon, label, shortcut, onClick }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
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
