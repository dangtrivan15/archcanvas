import { useEffect, useRef, useState } from 'react';
import { stringify } from 'yaml';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { publishNodeDef, PublishError } from '@/core/registry/remoteRegistry';

export function PublishNodeDefDialog() {
  const open = useUiStore((s) => s.showPublishNodeDefDialog);
  const def = useUiStore((s) => s.pendingPublish);
  const close = useUiStore((s) => s.closePublishNodeDefDialog);
  const setNotification = useUiStore((s) => s.setNotification);
  const { token, username, clearToken } = useAuthStore();

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the last non-null def so the dialog content remains visible
  // during the close animation (Radix animates open→false before unmounting,
  // but closePublishNodeDefDialog clears pendingPublish at the same time).
  const defRef = useRef(def);
  if (def) defRef.current = def;
  const displayDef = defRef.current;

  // Reset transient state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setError(null);
      setIsPublishing(false);
    }
  }, [open]);

  if (!displayDef) return null;

  const namespace = username ?? displayDef.metadata.namespace;
  const name = displayDef.metadata.name;
  const version = displayDef.metadata.version; // always present — schema enforces z.string()

  async function handlePublish() {
    if (!token || !displayDef) return;
    setIsPublishing(true);
    setError(null);
    try {
      const yaml = stringify(displayDef);
      await publishNodeDef({ namespace, name, version, yaml }, token);
      setNotification({
        message: `${namespace}/${name} v${version} published to the community registry!`,
        type: 'success',
      });
      close();
    } catch (err) {
      if (err instanceof PublishError) {
        if (err.statusCode === 401) {
          clearToken();
          setError('Your session has expired. Please sign in again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Publish to Registry</DialogTitle>
          <DialogDescription>
            Publishing makes this NodeDef publicly available at{' '}
            <span className="font-mono text-xs">registry.archcanvas.dev</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded bg-muted px-3 py-2 font-mono text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">Namespace: </span>
              {namespace}
            </div>
            <div>
              <span className="text-muted-foreground">Name: </span>
              {name}
            </div>
            <div>
              <span className="text-muted-foreground">Version: </span>
              {version}
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={close} disabled={isPublishing}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isPublishing || !token}
            onClick={() => { void handlePublish(); }}
          >
            {isPublishing ? 'Publishing…' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
