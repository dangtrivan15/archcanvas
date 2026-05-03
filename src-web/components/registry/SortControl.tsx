import { useCommunityBrowserStore } from '@/store/communityBrowserStore';
import type { SortOption } from '@/core/registry/remoteRegistry';
import { cn } from '@/lib/utils';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'recent',    label: 'Recently updated' },
  { value: 'name',      label: 'A–Z' },
];

export function SortControl() {
  const sort = useCommunityBrowserStore((s) => s.sort);
  const setSort = useCommunityBrowserStore((s) => s.setSort);

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border">
      {SORT_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={sort === value}
          onClick={() => setSort(value)}
          data-testid={`sort-${value}`}
          className={cn(
            'text-xs px-2 py-0.5 rounded transition-colors',
            sort === value
              ? 'bg-muted text-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted/50',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
