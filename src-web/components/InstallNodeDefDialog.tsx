import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
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

  // Keep a ref to the last non-null summary so the dialog content remains
  // visible during the close animation (Radix animates open→false before
  // unmounting, but closeInstallNodeDefDialog clears pendingInstall at the
  // same time as it sets showInstallNodeDefDialog:false).
  const summaryRef = useRef(summary);
  if (summary) summaryRef.current = summary;
  const displaySummary = summaryRef.current;

  // Reset transient state whenever the dialog opens so stale errors from a
  // previous session are never shown on a fresh open.
  useEffect(() => {
    if (open) {
      setError(null);
      setInstalling(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!fs || !displaySummary) return;
    setInstalling(true);
    setError(null);
    try {
      await useRegistryStore
        .getState()
        .installRemoteNodeDef(fs, projectPath ?? '', displaySummary);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstalling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Install Community NodeDef</DialogTitle>
          <DialogDescription>
            This definition will be downloaded from{' '}
            <span className="font-mono text-xs">registry.archcanvas.dev</span> and saved to{' '}
            <span className="font-mono text-xs">.archcanvas/nodedefs/</span>.
          </DialogDescription>
        </DialogHeader>

        {displaySummary && (
          <div className="space-y-2 rounded border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-24 text-muted-foreground">Name</span>
              <span className="font-mono">
                {displaySummary.namespace}/{displaySummary.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-muted-foreground">Version</span>
              <span className="font-mono">v{displaySummary.latestVer}</span>
            </div>
            {displaySummary.displayName && (
              <div className="flex items-center gap-2">
                <span className="w-24 text-muted-foreground">Display</span>
                <span>{displaySummary.displayName}</span>
              </div>
            )}
            {displaySummary.description && (
              <p className="pt-1 text-xs text-muted-foreground">{displaySummary.description}</p>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={close} disabled={installing}>
            Cancel
          </Button>
          <Button
            data-testid="install-nodedef-confirm"
            size="sm"
            onClick={handleConfirm}
            disabled={installing || !fs}
          >
            {installing ? 'Installing…' : 'Install'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
