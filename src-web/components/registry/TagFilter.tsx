import { useCommunityBrowserStore } from '@/store/communityBrowserStore';

export function TagFilter() {
  const tags = useCommunityBrowserStore((s) => s.tags);
  const activeTag = useCommunityBrowserStore((s) => s.tag);
  const setTag = useCommunityBrowserStore((s) => s.setTag);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 px-2 pb-2">
      <button
        onClick={() => setTag(null)}
        className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
          activeTag === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-accent/50 text-muted-foreground hover:bg-accent'
        }`}
        data-testid="tag-filter-all"
      >
        All
      </button>
      {tags.map(({ tag, count }) => (
        <button
          key={tag}
          onClick={() => setTag(tag === activeTag ? null : tag)}
          className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
            activeTag === tag
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent/50 text-muted-foreground hover:bg-accent'
          }`}
          data-testid={`tag-filter-${tag}`}
        >
          {tag} ({count})
        </button>
      ))}
    </div>
  );
}
