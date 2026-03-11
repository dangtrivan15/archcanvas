import { ScrollArea } from "@/components/ui/scroll-area";

export function RightPanel() {
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Detail Panel
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Select a node to view its properties.
        </p>
      </div>
    </ScrollArea>
  );
}
