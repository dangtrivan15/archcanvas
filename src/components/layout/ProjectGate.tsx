import { useFileStore } from '@/store/fileStore';

/**
 * Full-screen gate shown when no project is open (fileStore.fs === null).
 *
 * Provides two actions:
 * - Open Project: picks an existing directory with .archcanvas/main.yaml
 * - New Project: picks a directory and scaffolds .archcanvas/main.yaml if needed
 *
 * Shows error state if the last open/new attempt failed.
 */
export function ProjectGate() {
  const status = useFileStore((s) => s.status);
  const error = useFileStore((s) => s.error);

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
