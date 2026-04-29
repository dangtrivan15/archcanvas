import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFileStore } from "@/store/fileStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useUpdaterStore } from "@/store/updaterStore";
import { useDiffStore } from "@/store/diffStore";
import { useRegistryStore } from "@/store/registryStore";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from '@/store/authStore';
import { isKeycloakConfigured } from '@/core/auth/config';
import { useThemeStore, type StatusBarDensity } from "@/store/themeStore";
import { downloadAndInstall, relaunch } from "@/core/updater";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { Layers, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { duration, ease } from "@/lib/motion";

/** Per-density visual configuration for the status bar. */
const DENSITY_CONFIG: Record<StatusBarDensity, {
  height: string;
  text: string;
  px: string;
  gap: string;
}> = {
  compact:     { height: 'h-5',  text: 'text-[10px]', px: 'px-2',   gap: 'gap-2' },
  comfortable: { height: 'h-6',  text: 'text-xs',     px: 'px-3',   gap: 'gap-3' },
  expanded:    { height: 'h-8',  text: 'text-[13px]', px: 'px-3.5', gap: 'gap-3.5' },
};

export function StatusBar() {
  const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const dirtyCanvases = useFileStore((s) => s.dirtyCanvases);
  const getCanvas = useFileStore((s) => s.getCanvas);
  const projectFilePath = useFileStore((s) => s.project?.root.filePath ?? null);
  const fileName = projectFilePath ? projectFilePath.split('/').pop() : null;
  const prefersReduced = useReducedMotion();
  const density = useThemeStore((s) => s.statusBarDensity);
  const dc = DENSITY_CONFIG[density];

  const selectedNodeCount = useCanvasStore((s) => s.selectedNodeIds.size);
  const selectedEdgeCount = useCanvasStore((s) => s.selectedEdgeKeys.size);
  const selectionCount = selectedNodeCount + selectedEdgeCount;
  const layoutError = useCanvasStore((s) => s.layoutError);

  const updateStatus = useUpdaterStore((s) => s.status);
  const updateVersion = useUpdaterStore((s) => s.version);

  // Registry metadata
  const builtinCount = useRegistryStore((s) => s.builtinCount);
  const projectLocalCount = useRegistryStore((s) => s.projectLocalCount);
  const hasOverrides = useRegistryStore((s) => s.overrides.length > 0);
  const hasErrors = useRegistryStore((s) => s.loadErrors.length > 0);
  const availableUpdates = useRegistryStore((s) => s.availableUpdates);
  const pinnedVersions = useRegistryStore((s) => s.pinnedVersions);
  const effectiveUpdateCount = [...availableUpdates.entries()]
    .filter(([k, v]) => pinnedVersions.get(k) !== v).length;
  const openRegistryPanel = useUiStore((s) => s.openRegistryPanel);
  const { isAuthenticated, username } = useAuthStore();
  const keycloakEnabled = isKeycloakConfigured();

  // Diff overlay state
  const diffEnabled = useDiffStore((s) => s.enabled);
  const diffBaseRef = useDiffStore((s) => s.baseRef);
  const diffSummary = useDiffStore((s) => s.projectDiff?.summary);
  const diffError = useDiffStore((s) => s.error);
  const diffLoading = useDiffStore((s) => s.loading);

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
    <div
      data-testid="status-bar"
      className={`flex items-center justify-between border-t border-border bg-background text-muted-foreground transition-[height] ${prefersReduced ? 'duration-0' : 'duration-200'} ${dc.height} ${dc.text} ${dc.px}`}
    >
      <div className={`flex items-center ${dc.gap}`}>
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
              transition={{ duration: duration.normal, ease: ease.out }}
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-500 font-medium"
            >
              Modified
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className={`flex items-center ${dc.gap}`}>
        <AnimatePresence>
          {showUpdateIndicator && (
            <motion.button
              data-testid="update-indicator"
              initial={prefersReduced ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, x: 10 }}
              transition={{ duration: duration.moderate, ease: ease.out }}
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
          {diffError && !diffEnabled && (
            <motion.span
              data-testid="diff-error"
              initial={prefersReduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0, scale: 0.8 }}
              transition={{ duration: duration.normal, ease: ease.out }}
              className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-500 font-medium cursor-help"
              title={diffError}
            >
              Diff failed
            </motion.span>
          )}
          {diffEnabled && (
            <motion.span
              data-testid="diff-indicator"
              initial={prefersReduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0, scale: 0.8 }}
              transition={{ duration: duration.normal, ease: ease.out }}
              className={`rounded px-1.5 py-0.5 font-medium ${diffError ? 'bg-red-500/15 text-red-500 cursor-help' : 'bg-emerald-500/15 text-emerald-500'}`}
              title={diffError ?? undefined}
            >
              {diffLoading ? 'Diffing\u2026' : diffError ? 'Diff error' : (() => {
                if (!diffSummary) return `Diff: ${diffBaseRef}`;
                const total =
                  diffSummary.nodesAdded + diffSummary.nodesRemoved + diffSummary.nodesModified +
                  diffSummary.edgesAdded + diffSummary.edgesRemoved + diffSummary.edgesModified;
                if (total === 0) return `No changes vs ${diffBaseRef}`;
                const parts: string[] = [];
                if (diffSummary.nodesAdded > 0) parts.push(`+${diffSummary.nodesAdded}`);
                if (diffSummary.nodesRemoved > 0) parts.push(`−${diffSummary.nodesRemoved}`);
                if (diffSummary.nodesModified > 0) parts.push(`~${diffSummary.nodesModified}`);
                return `Diff: ${parts.join(' ')} vs ${diffBaseRef}`;
              })()}
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {layoutError && (
            <motion.span
              data-testid="layout-error"
              initial={prefersReduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0, scale: 0.8 }}
              transition={{ duration: duration.normal, ease: ease.out }}
              className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-500 font-medium cursor-help"
              title={layoutError}
            >
              Layout failed
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {selectionCount > 0 && (
            <motion.span
              data-testid="selection-count"
              initial={prefersReduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0, scale: 0.8 }}
              transition={{ duration: duration.normal, ease: ease.out }}
              className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-sky-500 font-medium"
            >
              {selectionCount} selected
            </motion.span>
          )}
        </AnimatePresence>
        <button
          data-testid="registry-indicator"
          onClick={openRegistryPanel}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent/50 transition-colors cursor-pointer"
          title={`${builtinCount} built-in${projectLocalCount > 0 ? ` + ${projectLocalCount} project` : ''} types`}
        >
          <Layers className="size-3" />
          <span>{builtinCount}{projectLocalCount > 0 && ` + ${projectLocalCount}`} types</span>
          {hasOverrides && <ArrowLeftRight className="size-3 text-amber-500" />}
          {hasErrors && <AlertTriangle className="size-3 text-red-500" />}
          <AnimatePresence>
            {effectiveUpdateCount > 0 && (
              <motion.span
                data-testid="nodedef-updates-badge"
                initial={prefersReduced ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0, scale: 0.8 }}
                transition={{ duration: duration.normal, ease: ease.out }}
                className="rounded bg-amber-500/15 px-1 py-0.5 text-amber-500 font-medium"
                title="Community NodeDef updates available"
              >
                Updates ({effectiveUpdateCount})
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        {isAuthenticated && username && keycloakEnabled && (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-primary">
            @{username}
          </span>
        )}
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
