import { useEffect } from 'react';
import { useCommunityBrowserStore } from '@/store/communityBrowserStore';
import { CommunitySearchBar } from './CommunitySearchBar';
import { NamespaceFilter } from './NamespaceFilter';
import { NodeDefCard } from './NodeDefCard';
import { NodeDefDetailView } from './NodeDefDetailView';

export function CommunityBrowser() {
  const results = useCommunityBrowserStore((s) => s.results);
  const loading = useCommunityBrowserStore((s) => s.loading);
  const error = useCommunityBrowserStore((s) => s.error);
  const selectedKey = useCommunityBrowserStore((s) => s.selectedKey);
  const selectNodeDef = useCommunityBrowserStore((s) => s.selectNodeDef);
  const _search = useCommunityBrowserStore((s) => s._search);
  const loadNamespaces = useCommunityBrowserStore((s) => s.loadNamespaces);
  const query = useCommunityBrowserStore((s) => s.query);
  const namespace = useCommunityBrowserStore((s) => s.namespace);

  useEffect(() => {
    loadNamespaces();
    _search(query, namespace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (selectedKey) {
    return <NodeDefDetailView />;
  }

  return (
    <div className="flex flex-col gap-0">
      <CommunitySearchBar />
      <NamespaceFilter />
      {loading && (
        <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
          Searching…
        </div>
      )}
      {error && !loading && (
        <div className="p-2 text-xs text-destructive">{error}</div>
      )}
      {!loading && !error && results.length === 0 && (
        <div className="p-4 text-xs text-muted-foreground">No results found.</div>
      )}
      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-1 p-2">
          {results.map((item) => (
            <NodeDefCard
              key={`${item.namespace}/${item.name}`}
              item={item}
              onSelect={selectNodeDef}
            />
          ))}
        </div>
      )}
    </div>
  );
}
