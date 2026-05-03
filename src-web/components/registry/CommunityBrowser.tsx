import { useEffect } from 'react';
import { useCommunityBrowserStore } from '@/store/communityBrowserStore';
import { CommunitySearchBar } from './CommunitySearchBar';
import { NamespaceFilter } from './NamespaceFilter';
import { TagFilter } from './TagFilter';
import { NodeDefCard } from './NodeDefCard';
import { NodeDefDetailView } from './NodeDefDetailView';
import { SortControl } from './SortControl';

export function CommunityBrowser() {
  const results = useCommunityBrowserStore((s) => s.results);
  const loading = useCommunityBrowserStore((s) => s.loading);
  const error = useCommunityBrowserStore((s) => s.error);
  const selectedKey = useCommunityBrowserStore((s) => s.selectedKey);
  const selectNodeDef = useCommunityBrowserStore((s) => s.selectNodeDef);
  const loadNamespaces = useCommunityBrowserStore((s) => s.loadNamespaces);
  const loadTags = useCommunityBrowserStore((s) => s.loadTags);
  const initFromUrl = useCommunityBrowserStore((s) => s.initFromUrl);

  useEffect(() => {
    loadNamespaces();
    loadTags();
    initFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable Zustand actions, intentionally run once on mount
  }, []);

  if (selectedKey) {
    return <NodeDefDetailView />;
  }

  return (
    <div className="flex flex-col gap-0">
      <CommunitySearchBar />
      <NamespaceFilter />
      <TagFilter />
      <SortControl />
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
      {!loading && !error && results.length > 0 && (
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
