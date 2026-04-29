import { useCommunityBrowserStore } from '@/store/communityBrowserStore';

export function CommunitySearchBar() {
  const query = useCommunityBrowserStore((s) => s.query);
  const setQuery = useCommunityBrowserStore((s) => s.setQuery);

  return (
    <div className="p-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search community registry…"
        className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        data-testid="community-search-input"
      />
    </div>
  );
}
