import { useCallback } from 'react';
import { useNavigationStore } from '@/store/navigationStore';

export function Breadcrumb() {
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);

  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index === breadcrumb.length - 2) {
      // One level up — triggers reverse morph via the transition hook
      window.dispatchEvent(new CustomEvent('archcanvas:navigate-up'));
    } else {
      // Multi-level jump — triggers dissolve via the transition hook
      window.dispatchEvent(
        new CustomEvent('archcanvas:navigate-to-breadcrumb', { detail: { index } }),
      );
    }
  }, [breadcrumb.length]);

  return (
    <div data-testid="breadcrumb" className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/80 rounded px-2 py-1 text-sm">
      {breadcrumb.map((entry, i) => (
        <span key={entry.canvasId} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-400">/</span>}
          {i < breadcrumb.length - 1 ? (
            <button
              className="text-blue-600 hover:underline"
              onClick={() => handleBreadcrumbClick(i)}
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
