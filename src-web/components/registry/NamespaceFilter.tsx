import { useCommunityBrowserStore } from '@/store/communityBrowserStore';

export function NamespaceFilter() {
  const namespaces = useCommunityBrowserStore((s) => s.namespaces);
  const activeNamespace = useCommunityBrowserStore((s) => s.namespace);
  const setNamespace = useCommunityBrowserStore((s) => s.setNamespace);

  if (namespaces.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 px-2 pb-2">
      <button
        onClick={() => setNamespace(null)}
        className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
          activeNamespace === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-accent/50 text-muted-foreground hover:bg-accent'
        }`}
        data-testid="namespace-filter-all"
      >
        All
      </button>
      {namespaces.map(({ namespace, count }) => (
        <button
          key={namespace}
          onClick={() => setNamespace(namespace === activeNamespace ? null : namespace)}
          className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
            activeNamespace === namespace
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent/50 text-muted-foreground hover:bg-accent'
          }`}
          data-testid={`namespace-filter-${namespace}`}
        >
          {namespace} ({count})
        </button>
      ))}
    </div>
  );
}
