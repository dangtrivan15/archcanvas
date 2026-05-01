import { useState } from 'react';
import { useCommunityBrowserStore } from '@/store/communityBrowserStore';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { NodeDef } from '@/types/nodeDefSchema';
import { ChevronLeft, Copy, Check } from 'lucide-react';

export function NodeDefDetailView() {
  const selectedDetail = useCommunityBrowserStore((s) => s.selectedDetail);
  const detailLoading = useCommunityBrowserStore((s) => s.detailLoading);
  const selectNodeDef = useCommunityBrowserStore((s) => s.selectNodeDef);
  const setNamespace = useCommunityBrowserStore((s) => s.setNamespace);
  const versionHistory = useCommunityBrowserStore((s) => s.versionHistory);
  const versionHistoryLoading = useCommunityBrowserStore((s) => s.versionHistoryLoading);
  const versionHistoryError = useCommunityBrowserStore((s) => s.versionHistoryError);
  const openInstallNodeDefDialog = useUiStore((s) => s.openInstallNodeDefDialog);
  const username = useAuthStore((s) => s.username);

  const [copied, setCopied] = useState(false);

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
  const snippet = `${nodedef.namespace}/${nodedef.name}@${nodedef.latestVer}`;
  const isOwner = username !== null && username === nodedef.namespace;

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
        <span>v{nodedef.latestVer}</span>
        <span>{nodedef.downloadCount} downloads</span>
      </div>

      {nodedef.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {nodedef.tags.map((tag) => (
            <span key={tag} className="rounded bg-accent/50 px-1.5 py-0.5 text-xs text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => openInstallNodeDefDialog(nodedef)}
        className="mt-2 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        data-testid="detail-install-btn"
      >
        Install
      </button>

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
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-card-foreground uppercase tracking-wide">Version History</h4>
        {versionHistoryLoading && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
        {versionHistoryError && !versionHistoryLoading && (
          <p className="text-xs text-destructive">{versionHistoryError}</p>
        )}
        {versionHistory && !versionHistoryLoading && (
          <ol className="flex flex-col gap-1">
            {versionHistory.map((v) => (
              <li key={v.version} className="flex items-center gap-2 text-xs">
                <span className="font-mono font-medium">{v.version}</span>
                <span className="text-muted-foreground">{new Date(v.publishedAt).toLocaleDateString()}</span>
                <span className="text-muted-foreground ml-auto">{v.downloadCount} ↓</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Manage section — owner only */}
      {isOwner && (
        <div className="flex flex-col gap-2 rounded border border-border p-2">
          <h4 className="text-xs font-semibold text-card-foreground uppercase tracking-wide">Manage</h4>
          <p className="text-xs text-muted-foreground">
            You are the publisher of this NodeDef. To publish a new version, install it into
            your local workspace and use the Publish command from the node's context menu.
          </p>
          <button
            onClick={() => openInstallNodeDefDialog(nodedef)}
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
