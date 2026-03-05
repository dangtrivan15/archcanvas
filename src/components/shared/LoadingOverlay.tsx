/**
 * LoadingOverlay - full-screen overlay with spinner shown during file operations.
 * Prevents interaction while a large file is being opened or saved.
 */

import { Loader2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export function LoadingOverlay() {
  const loading = useUIStore((s) => s.fileOperationLoading);
  const message = useUIStore((s) => s.fileOperationMessage);

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      data-testid="loading-overlay"
      role="status"
      aria-live="polite"
      aria-label={message ?? 'Loading...'}
    >
      <div
        className="bg-white rounded-lg shadow-xl px-8 py-6 flex flex-col items-center gap-3"
        data-testid="loading-overlay-content"
      >
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" data-testid="loading-spinner" />
        <p className="text-sm text-gray-700 font-medium" data-testid="loading-message">
          {message ?? 'Loading...'}
        </p>
      </div>
    </div>
  );
}
