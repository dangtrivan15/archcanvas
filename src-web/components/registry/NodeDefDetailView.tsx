import { useCommunityBrowserStore } from '@/store/communityBrowserStore';
import { useUiStore } from '@/store/uiStore';
import { ChevronLeft } from 'lucide-react';

export function NodeDefDetailView() {
  const selectedDetail = useCommunityBrowserStore((s) => s.selectedDetail);
  const detailLoading = useCommunityBrowserStore((s) => s.detailLoading);
  const selectNodeDef = useCommunityBrowserStore((s) => s.selectNodeDef);
  const openInstallNodeDefDialog = useUiStore((s) => s.openInstallNodeDefDialog);

  if (detailLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!selectedDetail) return null;

  const { nodedef } = selectedDetail;

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
        <p className="text-xs text-muted-foreground font-mono">{nodedef.namespace}/{nodedef.name}</p>
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
    </div>
  );
}
