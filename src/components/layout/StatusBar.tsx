import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFileStore } from "@/store/fileStore";
import { useNavigationStore } from "@/store/navigationStore";
import { SlidingNumber } from "@/components/ui/sliding-number";

export function StatusBar() {
  const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const dirtyCanvases = useFileStore((s) => s.dirtyCanvases);
  const getCanvas = useFileStore((s) => s.getCanvas);
  const projectFilePath = useFileStore((s) => s.project?.root.filePath ?? null);
  const fileName = projectFilePath ? projectFilePath.split('/').pop() : null;
  const prefersReduced = useReducedMotion();

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
        <AnimatePresence>
          {isDirty && (
            <motion.span
              initial={prefersReduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-500 font-medium"
            >
              Modified
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-3">
        {loaded ? (
          <>
            <span>{scopeName}</span>
            <span data-testid="node-count" data-count={nodeCount}><SlidingNumber number={nodeCount} /> {nodeCount === 1 ? 'node' : 'nodes'}</span>
            <span data-testid="edge-count" data-count={edgeCount}><SlidingNumber number={edgeCount} /> {edgeCount === 1 ? 'edge' : 'edges'}</span>
          </>
        ) : (
          <span>No project open</span>
        )}
      </div>
    </div>
  );
}
