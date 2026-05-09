import { useState } from 'react';
import { useCommunityBrowserStore } from '@/store/communityBrowserStore';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useRegistryStore } from '@/store/registryStore';
import { useFileStore } from '@/store/fileStore';
import { NodeDef } from '@/types/nodeDefSchema';
import { parseSemVer, type SemVer } from '@/core/registry/version';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, Copy, Check, Trash2, AlertTriangle } from 'lucide-react';

function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function NodeDefDetailView() {
  const selectedDetail = useCommunityBrowserStore((s) => s.selectedDetail);
  const detailLoading = useCommunityBrowserStore((s) => s.detailLoading);
  const selectNodeDef = useCommunityBrowserStore((s) => s.selectNodeDef);
  const selectVersion = useCommunityBrowserStore((s) => s.selectVersion);
  const selectedVersion = useCommunityBrowserStore((s) => s.selectedVersion);
  const setNamespace = useCommunityBrowserStore((s) => s.setNamespace);
  const setTag = useCommunityBrowserStore((s) => s.setTag);
  const versionHistory = useCommunityBrowserStore((s) => s.versionHistory);
  const versionHistoryLoading = useCommunityBrowserStore((s) => s.versionHistoryLoading);
  const versionHistoryError = useCommunityBrowserStore((s) => s.versionHistoryError);
  const openInstallNodeDefDialog = useUiStore((s) => s.openInstallNodeDefDialog);
  const username = useAuthStore((s) => s.username);
  const remoteInstalledKeys = useRegistryStore((s) => s.remoteInstalledKeys);
  const remoteInstalledVersions = useRegistryStore((s) => s.remoteInstalledVersions);
  const builtinKeys = useRegistryStore((s) => s.builtinKeys);
  const uninstallRemoteNodeDef = useRegistryStore((s) => s.uninstallRemoteNodeDef);
  const fs = useFileStore((s) => s.fs);
  const projectPath = useFileStore((s) => s.projectPath);

  const [copied, setCopied] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

  if (detailLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!selectedDetail) return null;

  const { nodedef } = selectedDetail;
  const parsedSpec = NodeDef.safeParse(selectedDetail.version.blob);
  const snippet = `${nodedef.namespace}/${nodedef.name}@${selectedDetail.version.version}`;
  const isOwner = username !== null && username === nodedef.namespace;

  const key = `${nodedef.namespace}/${nodedef.name}`;
  const isInstalled = remoteInstalledKeys.has(key);
  const installedVersion = remoteInstalledVersions.get(key);
  const viewedVersion = selectedVersion ?? selectedDetail.version.version;
  const collidesWithBuiltin = builtinKeys.has(key);

  let installLabel = 'Install';
  let installDisabled = false;
  if (isInstalled && installedVersion) {
    if (viewedVersion === installedVersion) {
      installLabel = 'Installed ✓';
      installDisabled = true;
    } else {
      const viewedSv = parseSemVer(viewedVersion);
      const installedSv = parseSemVer(installedVersion);
      if (viewedSv && installedSv) {
        const cmp = compareSemVer(viewedSv, installedSv);
        installLabel = cmp > 0
          ? `Update to v${viewedVersion}`
          : `Install v${viewedVersion} (downgrade)`;
      } else {
        installLabel = `Install v${viewedVersion}`;
      }
    }
  } else if (collidesWithBuiltin) {
    installLabel = 'Install (overrides built-in)';
  }

  const inboundPorts = parsedSpec.success
    ? (parsedSpec.data.spec.ports?.filter((p) => p.direction === 'inbound') ?? [])
    : [];
  const outboundPorts = parsedSpec.success
    ? (parsedSpec.data.spec.ports?.filter((p) => p.direction === 'outbound') ?? [])
    : [];
  const specArgs = parsedSpec.success ? (parsedSpec.data.spec.args ?? []) : [];

  return (
    <div className="flex flex-col gap-3 p-2">
      <button
        onClick={() => selectNodeDef(null)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        data-testid="detail-back-btn"
      >
        <ChevronLeft className="size-3" /> Back
      </button>

      <div>
        <h3 className="text-sm font-medium text-card-foreground">
          {nodedef.displayName ?? `${nodedef.namespace}/${nodedef.name}`}
        </h3>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { setNamespace(nodedef.namespace); selectNodeDef(null); }}
            className="text-xs text-primary hover:underline font-mono"
            data-testid="detail-namespace-btn"
          >
            {nodedef.namespace}
          </button>
          <span className="text-xs text-muted-foreground font-mono">/{nodedef.name}</span>
        </div>
      </div>

      {nodedef.description && (
        <p className="text-xs text-muted-foreground">{nodedef.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>v{selectedDetail.version.version}</span>
        <span>{nodedef.downloadCount} downloads</span>
      </div>

      {nodedef.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {nodedef.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => { setTag(tag); selectNodeDef(null); }}
              className="rounded bg-accent/50 px-1.5 py-0.5 text-xs text-muted-foreground cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => {
            if (installDisabled) return;
            openInstallNodeDefDialog({ ...nodedef, latestVer: viewedVersion });
          }}
          disabled={installDisabled}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:hover:bg-primary disabled:cursor-not-allowed"
          data-testid="detail-install-btn"
        >
          {installLabel}
        </button>
        {isInstalled && (
          <button
            onClick={() => setUninstallOpen(true)}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-accent/50 transition-colors"
            data-testid="detail-uninstall-btn"
          >
            <Trash2 className="size-3" /> Uninstall
          </button>
        )}
      </div>

      <Dialog open={uninstallOpen} onOpenChange={(v) => !v && !uninstalling && setUninstallOpen(false)}>
        <DialogContent className="max-w-md" data-testid="uninstall-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Uninstall {key}?</DialogTitle>
            <DialogDescription>
              The file{' '}
              <span className="font-mono text-xs">.archcanvas/nodedefs/{nodedef.namespace}-{nodedef.name}.yaml</span>{' '}
              will be removed and the lockfile entry cleared.
              {collidesWithBuiltin && (
                <>
                  {' '}The built-in <span className="font-mono text-xs">{key}</span> will be used instead.
                </>
              )}{' '}
              You can re-install from the Community tab at any time.
            </DialogDescription>
          </DialogHeader>
          {collidesWithBuiltin && (
            <p className="flex items-start gap-1.5 text-xs text-amber-500">
              <AlertTriangle className="size-3 mt-0.5 shrink-0" />
              <span>This will restore the built-in version.</span>
            </p>
          )}
          <DialogFooter>
            <button
              onClick={() => setUninstallOpen(false)}
              disabled={uninstalling}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!fs) return;
                setUninstalling(true);
                try {
                  await uninstallRemoteNodeDef(fs, projectPath ?? '', nodedef.namespace, nodedef.name);
                  setUninstallOpen(false);
                } finally {
                  setUninstalling(false);
                }
              }}
              disabled={uninstalling || !fs}
              className="rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              data-testid="uninstall-confirm-btn"
            >
              {uninstalling ? 'Uninstalling…' : 'Uninstall'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specification section */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-card-foreground uppercase tracking-wide">Specification</h4>
        {parsedSpec.success ? (
          <>
            {inboundPorts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Input Ports</p>
                {inboundPorts.map((port) => (
                  <div key={port.name} className="text-xs pl-2 border-l border-border mb-1">
                    <span className="font-mono font-medium">{port.name}</span>
                    <span className="text-muted-foreground ml-1">[{port.protocol.join(', ')}]</span>
                    {port.description && <p className="text-muted-foreground">{port.description}</p>}
                  </div>
                ))}
              </div>
            )}
            {outboundPorts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Output Ports</p>
                {outboundPorts.map((port) => (
                  <div key={port.name} className="text-xs pl-2 border-l border-border mb-1">
                    <span className="font-mono font-medium">{port.name}</span>
                    <span className="text-muted-foreground ml-1">[{port.protocol.join(', ')}]</span>
                    {port.description && <p className="text-muted-foreground">{port.description}</p>}
                  </div>
                ))}
              </div>
            )}
            {specArgs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Arguments</p>
                {specArgs.map((arg) => (
                  <div key={arg.name} className="text-xs pl-2 border-l border-border mb-1">
                    <span className="font-mono font-medium">{arg.name}</span>
                    <span className="rounded bg-accent/50 px-1 py-0.5 text-xs ml-1">{arg.type}</span>
                    {arg.required && <span className="text-destructive ml-1">*</span>}
                    {arg.description && <p className="text-muted-foreground">{arg.description}</p>}
                    {arg.default !== undefined && (
                      <p className="text-muted-foreground">default: <span className="font-mono">{String(arg.default)}</span></p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">Spec unavailable</p>
        )}
      </div>

      {/* Install snippet section */}
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold text-card-foreground uppercase tracking-wide">Install</h4>
        <div className="flex items-center gap-2 rounded bg-muted px-2 py-1.5">
          <code className="flex-1 text-xs font-mono truncate">{snippet}</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(snippet).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }).catch(() => {
                // Clipboard API unavailable — snippet is already visible in the code block
              });
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Copy install snippet"
            data-testid="detail-copy-btn"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>

      {/* Version history section */}
      {(versionHistoryLoading || versionHistoryError || (versionHistory && versionHistory.length > 1)) && (
        <div className="flex flex-col gap-2" data-testid="version-history-section">
          <h4 className="text-xs font-semibold text-card-foreground uppercase tracking-wide">Version History</h4>
          {versionHistoryLoading && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {versionHistoryError && !versionHistoryLoading && (
            <p className="text-xs text-destructive">{versionHistoryError}</p>
          )}
          {versionHistory && versionHistory.length > 1 && !versionHistoryLoading && (
            <ol className="flex flex-col gap-1">
              {versionHistory.map((v) => {
                const isActive =
                  v.version === (selectedVersion ?? selectedDetail.version.version);
                return (
                  <li
                    key={v.version}
                    onClick={() => selectVersion(v.version)}
                    data-testid={`version-row-${v.version}`}
                    className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1
                      hover:bg-accent/50 transition-colors
                      ${isActive ? 'font-semibold text-primary' : 'text-muted-foreground'}`}
                  >
                    <span className="font-mono font-medium">{v.version}</span>
                    <span>{new Date(v.publishedAt).toLocaleDateString()}</span>
                    <span className="ml-auto">{v.downloadCount} ↓</span>
                    {isActive && <span className="sr-only">(current)</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* Manage section — owner only */}
      {isOwner && (
        <div className="flex flex-col gap-2 rounded border border-border p-2">
          <h4 className="text-xs font-semibold text-card-foreground uppercase tracking-wide">Manage</h4>
          <p className="text-xs text-muted-foreground">
            You are the publisher of this NodeDef. To publish a new version, install it into
            your local workspace and use the Publish command from the node's context menu.
          </p>
          <button
            onClick={() => openInstallNodeDefDialog({ ...nodedef, latestVer: selectedDetail.version.version })}
            className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
            data-testid="detail-manage-install-btn"
          >
            Install to Workspace
          </button>
        </div>
      )}
    </div>
  );
}
