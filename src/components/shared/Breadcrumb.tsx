import { useNavigationStore } from '@/store/navigationStore';

export function Breadcrumb() {
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const goToBreadcrumb = useNavigationStore((s) => s.goToBreadcrumb);

  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/80 rounded px-2 py-1 text-sm">
      {breadcrumb.map((entry, i) => (
        <span key={entry.canvasId} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-400">/</span>}
          {i < breadcrumb.length - 1 ? (
            <button
              className="text-blue-600 hover:underline"
              onClick={() => goToBreadcrumb(i)}
            >
              {entry.displayName}
            </button>
          ) : (
            <span className="text-gray-700 font-medium">{entry.displayName}</span>
          )}
        </span>
      ))}
    </div>
  );
}
