import { useEffect, useRef } from 'react';
import { useFileStore } from '@/store/fileStore';

/**
 * Full-screen gate shown when no project is open (fileStore.fs === null).
 *
 * Provides two actions:
 * - Open Project: picks an existing directory with .archcanvas/main.yaml
 * - New Project: picks a directory and scaffolds .archcanvas/main.yaml if needed
 *
 * Shows error state if the last open/new attempt failed.
 *
 * Also handles URL params for one-project-per-tab:
 * - ?action=open — auto-fires open() on mount
 * - ?action=new  — auto-fires newProject() on mount
 */
export function ProjectGate() {
  const status = useFileStore((s) => s.status);
  const error = useFileStore((s) => s.error);
  const actionFired = useRef(false);

  // Auto-trigger from URL param (one-project-per-tab)
  useEffect(() => {
    if (actionFired.current) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (!action) return;

    actionFired.current = true;

    // Clear the param from the URL so it doesn't re-trigger on navigation
    params.delete('action');
    const nextSearch = params.toString();
    const nextUrl = window.location.pathname + (nextSearch ? `?${nextSearch}` : '');
    window.history.replaceState({}, '', nextUrl);

    if (action === 'open') {
      useFileStore.getState().open();
    } else if (action === 'new') {
      useFileStore.getState().newProject();
    }
  }, []);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-8">
        {/* Logo / Heading */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">ArchCanvas</h1>
          <p className="text-sm text-muted-foreground">
            Open an existing project or create a new one to get started.
          </p>
        </div>

        {/* Error banner */}
        {status === 'error' && error && (
          <div
            role="alert"
            className="w-80 rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            <p className="font-medium">Failed to load project</p>
            <p className="mt-1 text-red-400/80">{error}</p>
          </div>
        )}

        {/* Loading indicator */}
        {status === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading project...</p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <button
            className="w-64 rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
            onClick={() => useFileStore.getState().open()}
            disabled={status === 'loading'}
          >
            <span>Open Project</span>
            <span className="ml-2 text-xs text-accent-foreground/60">
              {'\u2318'}O
            </span>
          </button>

          <button
            className="w-64 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
            onClick={() => useFileStore.getState().newProject()}
            disabled={status === 'loading'}
          >
            New Project
          </button>
        </div>
      </div>
    </div>
  );
}
