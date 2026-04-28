import { useEffect, Fragment } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import { useUiStore } from '@/store/uiStore';
import { useRegistryStore } from '@/store/registryStore';
import { useFileStore } from '@/store/fileStore';
import { useAuthStore } from '@/store/authStore';
import { isKeycloakConfigured } from '@/core/auth/config';
import { AuthStatusSection } from '@/components/auth/AuthStatusSection';
import { RefreshCw, AlertTriangle, ArrowLeftRight, Layers } from 'lucide-react';

export function RegistryStatusDialog() {
  const open = useUiStore((s) => s.showRegistryStatusDialog);
  const close = useUiStore((s) => s.closeRegistryStatusDialog);

  const builtinCount = useRegistryStore((s) => s.builtinCount);
  const projectLocalCount = useRegistryStore((s) => s.projectLocalCount);
  const projectLocalKeys = useRegistryStore((s) => s.projectLocalKeys);
  const remoteInstalledCount = useRegistryStore((s) => s.remoteInstalledCount);
  const remoteInstalledKeys = useRegistryStore((s) => s.remoteInstalledKeys);
  const overrides = useRegistryStore((s) => s.overrides);
  const loadErrors = useRegistryStore((s) => s.loadErrors);
  const lockfile = useRegistryStore((s) => s.lockfile);
  const registry = useRegistryStore((s) => s.registry);
  const allDefs = registry?.list() ?? [];

  const fs = useFileStore((s) => s.fs);
  const projectPath = useFileStore((s) => s.projectPath);

  const { isAuthenticated } = useAuthStore();
  const notification = useUiStore((s) => s.notification);
  const clearNotification = useUiStore((s) => s.clearNotification);
  const keycloakEnabled = isKeycloakConfigured();

  // Auto-clear notification banner after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const id = setTimeout(clearNotification, 4000);
    return () => clearTimeout(id);
  }, [notification, clearNotification]);

  function handleReload() {
    if (!fs) return;
    useRegistryStore.getState().reloadProjectLocal(fs, projectPath ?? '');
  }

  // Group defs by source
  const builtinDefs = allDefs.filter(d => {
    const key = `${d.metadata.namespace}/${d.metadata.name}`;
    return !projectLocalKeys.has(key) && !remoteInstalledKeys.has(key);
  });
  const projectLocalDefs = allDefs.filter(d => {
    const key = `${d.metadata.namespace}/${d.metadata.name}`;
    return projectLocalKeys.has(key);
  });
  const remoteInstalledDefs = allDefs.filter(d => {
    const key = `${d.metadata.namespace}/${d.metadata.name}`;
    return remoteInstalledKeys.has(key);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <AuthStatusSection />
        {notification && (
          <div
            className={`mx-3 mt-2 rounded px-3 py-2 text-xs ${
              notification.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-destructive/15 text-destructive'
            }`}
            role="status"
          >
            {notification.message}
          </div>
        )}
        <DialogHeader>
          <DialogTitle>Node Type Registry</DialogTitle>
          <DialogDescription>
            {`${builtinCount} built-in`}
            {projectLocalCount > 0 && ` + ${projectLocalCount} project-local`}
            {remoteInstalledCount > 0 && ` + ${remoteInstalledCount} community`}
            {' types'}
          </DialogDescription>
        </DialogHeader>

        {/* Summary badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-500">
            <Layers className="size-3" /> {builtinCount} built-in
          </span>
          {projectLocalCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
              {projectLocalCount} project-local
            </span>
          )}
          {overrides.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
              <ArrowLeftRight className="size-3" /> {overrides.length} override{overrides.length > 1 ? 's' : ''}
            </span>
          )}
          {remoteInstalledCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-500">
              {remoteInstalledCount} community
            </span>
          )}
          {loadErrors.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-500">
              <AlertTriangle className="size-3" /> {loadErrors.length} error{loadErrors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Errors section */}
        {loadErrors.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-500">Validation Errors</p>
            {loadErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 rounded border border-red-500/20 bg-red-500/5 p-2 text-xs">
                <AlertTriangle className="size-3 mt-0.5 shrink-0 text-red-500" />
                <div>
                  <span className="font-medium text-card-foreground">{err.file}</span>
                  <p className="text-muted-foreground">{err.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Project-local types */}
        {projectLocalDefs.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-card-foreground">Project-Local Types</p>
            {isAuthenticated && keycloakEnabled && (
              <p className="px-2 pb-1 text-[10px] text-muted-foreground/60">
                Right-click a NodeDef to publish it to the community registry
              </p>
            )}
            <div className="space-y-0.5">
              {projectLocalDefs.map(def => {
                const key = `${def.metadata.namespace}/${def.metadata.name}`;
                const isOverride = overrides.includes(key);

                const rowContent = (
                  <div
                    className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-accent/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-card-foreground">{key}</span>
                      <span className="text-muted-foreground">{def.metadata.displayName}</span>
                    </div>
                    {isOverride && (
                      <span className="inline-flex items-center gap-1 text-amber-500" title="Overrides built-in type">
                        <ArrowLeftRight className="size-3" /> override
                      </span>
                    )}
                  </div>
                );

                if (isAuthenticated && keycloakEnabled) {
                  return (
                    <ContextMenu key={key}>
                      <ContextMenuTrigger asChild>
                        {rowContent}
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          onSelect={() => useUiStore.getState().openPublishNodeDefDialog(def)}
                        >
                          Publish to Registry
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                }

                // Unauthenticated: plain row, no context menu wrapper needed
                return <Fragment key={key}>{rowContent}</Fragment>;
              })}
            </div>
          </div>
        )}

        {/* Community-Installed types */}
        {remoteInstalledDefs.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-card-foreground">
              Community-Installed ({remoteInstalledDefs.length})
            </p>
            <div className="space-y-0.5">
              {remoteInstalledDefs.map(def => {
                const key = `${def.metadata.namespace}/${def.metadata.name}`;
                const entry = lockfile?.entries[key];
                return (
                  <div key={key} className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-accent/30">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-card-foreground">{key}</span>
                      <span className="text-muted-foreground">{def.metadata.displayName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>registry.archcanvas.dev</span>
                      {entry && <span className="font-mono">v{entry.version}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Built-in types (scrollable for brevity) */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-card-foreground">Built-in Types ({builtinDefs.length})</p>
          <div className="max-h-40 overflow-y-auto space-y-0.5 rounded border border-border p-1">
            {builtinDefs.map(def => {
              const key = `${def.metadata.namespace}/${def.metadata.name}`;
              return (
                <div key={key} className="flex items-center gap-2 px-2 py-0.5 text-xs">
                  <span className="font-mono text-card-foreground">{key}</span>
                  <span className="text-muted-foreground">{def.metadata.displayName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {projectPath ? `.archcanvas/nodedefs/` : 'Project path not set'}
          </span>
          <button
            data-testid="registry-reload-btn"
            onClick={handleReload}
            disabled={!fs}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-card-foreground transition-colors hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="size-3" />
            Reload
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
