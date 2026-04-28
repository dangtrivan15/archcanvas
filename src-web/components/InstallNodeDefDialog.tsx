import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useUiStore } from '@/store/uiStore';
import { useRegistryStore } from '@/store/registryStore';
import { useFileStore } from '@/store/fileStore';

export function InstallNodeDefDialog() {
  const open = useUiStore((s) => s.showInstallNodeDefDialog);
  const summary = useUiStore((s) => s.pendingInstall);
  const close = useUiStore((s) => s.closeInstallNodeDefDialog);
  const fs = useFileStore((s) => s.fs);
  const projectPath = useFileStore((s) => s.projectPath);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!fs || !summary) return;
    setInstalling(true);
    setError(null);
    try {
      await useRegistryStore.getState().installRemoteNodeDef(fs, projectPath ?? '', summary);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstalling(false);
    }
  }

  if (!summary) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Install Community NodeDef</DialogTitle>
          <DialogDescription>
            This definition will be downloaded from{' '}
            <span className="font-mono text-xs">registry.archcanvas.dev</span> and
            saved to{' '}
            <span className="font-mono text-xs">.archcanvas/nodedefs/</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded border border-border bg-muted/30 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-24">Name</span>
            <span className="font-mono">{summary.namespace}/{summary.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-24">Version</span>
            <span className="font-mono">v{summary.version}</span>
          </div>
          {summary.displayName && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24">Display</span>
              <span>{summary.displayName}</span>
            </div>
          )}
          {summary.description && (
            <p className="text-xs text-muted-foreground pt-1">{summary.description}</p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={close}
            disabled={installing}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            data-testid="install-nodedef-confirm"
            onClick={handleConfirm}
            disabled={installing || !fs}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
