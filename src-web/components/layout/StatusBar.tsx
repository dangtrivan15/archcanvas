import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFileStore } from "@/store/fileStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useUpdaterStore } from "@/store/updaterStore";
import { downloadAndInstall, relaunch } from "@/core/updater";
import { SlidingNumber } from "@/components/ui/sliding-number";

export function StatusBar() {
  const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const dirtyCanvases = useFileStore((s) => s.dirtyCanvases);
  const getCanvas = useFileStore((s) => s.getCanvas);
  const projectFilePath = useFileStore((s) => s.project?.root.filePath ?? null);
  const fileName = projectFilePath ? projectFilePath.split('/').pop() : null;
  const prefersReduced = useReducedMotion();

  const selectedNodeCount = useCanvasStore((s) => s.selectedNodeIds.size);
  const selectedEdgeCount = useCanvasStore((s) => s.selectedEdgeKeys.size);
  const selectionCount = selectedNodeCount + selectedEdgeCount;

  const updateStatus = useUpdaterStore((s) => s.status);
  const updateVersion = useUpdaterStore((s) => s.version);

  const loaded = getCanvas(currentCanvasId);
  const nodeCount = loaded?.data.nodes?.length ?? 0;
  const edgeCount = loaded?.data.edges?.length ?? 0;

  const scopeName = breadcrumb[breadcrumb.length - 1]?.displayName ?? 'Root';
  const isDirty = dirtyCanvases.size > 0;

  function handleUpdateClick() {
    if (updateStatus === 'update-available') {
      downloadAndInstall();
    } else if (updateStatus === 'ready-to-restart') {
      relaunch();
    }
  }

  const showUpdateIndicator =
    updateStatus === 'update-available' ||
    updateStatus === 'downloading' ||
    updateStatus === 'ready-to-restart';

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
        <AnimatePresence>
          {showUpdateIndicator && (
            <motion.button
              data-testid="update-indicator"
              initial={prefersReduced ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, x: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={handleUpdateClick}
              disabled={updateStatus === 'downloading'}
              className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                updateStatus === 'downloading'
                  ? 'text-muted-foreground cursor-default'
                  : 'text-sky-500 hover:bg-sky-500/15 cursor-pointer'
              }`}
            >
              {updateStatus === 'update-available' && `v${updateVersion} available`}
              {updateStatus === 'downloading' && 'Downloading update\u2026'}
              {updateStatus === 'ready-to-restart' && 'Restart to update'}
            </motion.button>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {selectionCount > 0 && (
            <motion.span
              data-testid="selection-count"
              initial={prefersReduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-sky-500 font-medium"
            >
              {selectionCount} selected
            </motion.span>
          )}
        </AnimatePresence>
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
