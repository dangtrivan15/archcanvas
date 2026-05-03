import { useRegistryStore } from '@/store/registryStore';
import { useCommunityBrowserStore } from '@/store/communityBrowserStore';
import type { RemoteNodeDefSummary } from '@/core/registry/remoteRegistry';

interface NodeDefCardProps {
  item: RemoteNodeDefSummary;
  onSelect: (key: string) => void;
}

export function NodeDefCard({ item, onSelect }: NodeDefCardProps) {
  const installedVersions = useRegistryStore((s) => s.remoteInstalledVersions);
  const key = `${item.namespace}/${item.name}`;
  const installedVer = installedVersions.get(key);
  const setTag = useCommunityBrowserStore((s) => s.setTag);

  return (
    <div
      className="flex cursor-pointer items-start justify-between rounded border border-border p-2 text-xs hover:bg-accent/30 transition-colors"
      onClick={() => onSelect(key)}
      data-testid={`nodedef-card-${key}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-card-foreground">{key}</span>
          {item.displayName && (
            <span className="text-muted-foreground">{item.displayName}</span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-muted-foreground truncate">{item.description}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-muted-foreground">
          <span>{item.downloadCount} downloads</span>
          <span>v{item.latestVer}</span>
        </div>
        {item.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                onClick={(e) => { e.stopPropagation(); setTag(tag); }}
                className="rounded-full bg-accent/50 px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ml-2 shrink-0">
        {installedVer !== undefined ? (
          <span className="inline-flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-500"
            data-testid={`installed-badge-${key}`}>
            Installed v{installedVer}
          </span>
        ) : (
          <span className="inline-flex items-center rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-medium text-sky-500">
            Install
          </span>
        )}
      </div>
    </div>
  );
}
