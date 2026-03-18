import { useFileStore } from "@/store/fileStore";
import { useNavigationStore } from "@/store/navigationStore";

export function StatusBar() {
  const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const dirtyCanvases = useFileStore((s) => s.dirtyCanvases);
  const getCanvas = useFileStore((s) => s.getCanvas);
  const projectFilePath = useFileStore((s) => s.project?.root.filePath ?? null);
  const fileName = projectFilePath ? projectFilePath.split('/').pop() : null;

  const loaded = getCanvas(currentCanvasId);
  const nodeCount = loaded?.data.nodes?.length ?? 0;
  const edgeCount = loaded?.data.edges?.length ?? 0;

  const scopeName = breadcrumb[breadcrumb.length - 1]?.displayName ?? 'Root';
  const isDirty = dirtyCanvases.size > 0;

  return (
    <div className="flex h-6 items-center justify-between border-t border-border bg-background px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>ArchCanvas v0.1.0</span>
        {fileName && (
          <span className="text-muted-foreground/60">{fileName}</span>
        )}
        {isDirty && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-500 font-medium">
            Modified
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {loaded ? (
          <>
            <span>{scopeName}</span>
            <span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
            <span>{edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}</span>
          </>
        ) : (
          <span>No project open</span>
        )}
      </div>
    </div>
  );
}
