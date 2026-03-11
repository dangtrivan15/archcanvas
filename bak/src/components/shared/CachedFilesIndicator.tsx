import { useState } from 'react';
import { HardDrive, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useCachedFiles } from '@/hooks/useCachedFiles';

/**
 * A small indicator in the status bar or toolbar area showing cached files count.
 * Expanding it shows the list of cached .archc files with option to remove them.
 */
export function CachedFilesIndicator() {
  const {
    cachedFiles,
    cachedFileCount,
    isLoading,
    removeCachedFile,
    clearAllCachedFiles,
    refreshCachedFiles,
  } = useCachedFiles();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading || cachedFileCount === 0) {
    return null;
  }

  return (
    <div className="relative" data-testid="cached-files-indicator">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        onClick={() => {
          refreshCachedFiles();
          setIsExpanded((prev) => !prev);
        }}
        aria-label={`${cachedFileCount} cached file${cachedFileCount !== 1 ? 's' : ''}`}
        data-testid="cached-files-toggle"
      >
        <HardDrive className="w-3.5 h-3.5" />
        <span>{cachedFileCount} cached</span>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isExpanded && (
        <div
          className="absolute bottom-full left-0 mb-1 w-64 bg-white border rounded-md shadow-lg z-50 text-sm"
          data-testid="cached-files-list"
        >
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="font-medium text-xs text-gray-700">
              Cached Files ({cachedFileCount})
            </span>
            <button
              type="button"
              onClick={async () => {
                await clearAllCachedFiles();
                setIsExpanded(false);
              }}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
              data-testid="cached-files-clear-all"
            >
              Clear All
            </button>
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {cachedFiles.map((file) => (
              <li
                key={file.url}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 group"
                data-testid="cached-file-entry"
              >
                <span className="flex-1 truncate text-xs text-gray-600">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeCachedFile(file.url)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50"
                  aria-label={`Remove ${file.name} from cache`}
                  data-testid="cached-file-remove"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
