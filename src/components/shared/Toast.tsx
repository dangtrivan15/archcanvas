/**
 * Toast - lightweight notification that auto-dismisses.
 * Used for feedback messages like deletion undo hints.
 */

import { X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export function Toast() {
  const toastMessage = useUIStore((s) => s.toastMessage);
  const clearToast = useUIStore((s) => s.clearToast);

  if (!toastMessage) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 bg-overlay text-foreground text-sm px-4 py-2.5 rounded-lg shadow-lg border border-border animate-in fade-in slide-in-from-bottom-2 duration-200"
      role="status"
      aria-live="polite"
      data-testid="toast"
    >
      <span data-testid="toast-message">{toastMessage}</span>
      <button
        onClick={clearToast}
        className="ml-1 p-0.5 rounded hover:bg-highlight-low text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        data-testid="toast-dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
