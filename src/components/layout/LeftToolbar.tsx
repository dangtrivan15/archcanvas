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

const tools = [
  { icon: MousePointer2, label: "Select", shortcut: "V" },
  { icon: Hand, label: "Pan", shortcut: "H" },
  { icon: Square, label: "Add Node", shortcut: "N" },
  { icon: Cable, label: "Connect", shortcut: "C" },
  { icon: Search, label: "Search", shortcut: "⌘K" },
  { icon: LayoutGrid, label: "Auto Layout", shortcut: "⌘L" },
  { icon: Undo2, label: "Undo", shortcut: "⌘Z" },
  { icon: Redo2, label: "Redo", shortcut: "⇧⌘Z" },
] as const;

export function LeftToolbar() {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center gap-1 p-2">
        {tools.map(({ icon: Icon, label, shortcut }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
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
