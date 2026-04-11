import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useFileStore } from '@/store/fileStore';
import { consumeRestoreEntry } from '@/core/restoreProject';
import { getLastActiveProject } from '@/core/lastActiveProject';
import { focusCurrentWindow } from '@/core/focusWindow';
import { Shine } from '@/components/ui/shine';
import { AnimatedBanner } from '@/components/ui/animated-banner';
import { duration, ease } from '@/lib/motion';

/**
 * Full-screen gate shown when no project is open (fileStore.fs === null).
 *
 * Provides a single "Open…" action that picks a directory. The system
 * auto-detects new vs existing projects by checking for .archcanvas/main.yaml.
 *
 * Shows error state if the last open attempt failed.
 *
 * Handles URL params for multi-tab/window flow:
 * - ?openPath=<path> — loads project from filesystem path (Tauri Open Recent)
 * - ?action=open — auto-fires open() on mount (shows directory picker)
 * - ?recent=<key> — loads project from IndexedDB handle (web Open Recent)
 */
export function ProjectGate() {
  const status = useFileStore((s) => s.status);
  const error = useFileStore((s) => s.error);
  const recentProjects = useFileStore((s) => s.recentProjects);
  const actionFired = useRef(false);
  const prefersReduced = useReducedMotion();

  // Auto-trigger from URL param (one-project-per-tab)
  useEffect(() => {
    (async () => {
      if (actionFired.current) return;

      // Priority 1: Restore project after an update-triggered relaunch (consume-on-read)
      const restorePath = consumeRestoreEntry();
      if (restorePath) {
        actionFired.current = true;
        try {
          const { TauriFileSystem } = await import('../../platform/tauriFileSystem');
          const fs = new TauriFileSystem(restorePath);
          await useFileStore.getState().openProject(fs);
          // Best-effort: bring window to foreground after update-triggered restore
          focusCurrentWindow();
        } catch (err) {
          useFileStore.setState({
            status: 'error',
            error: `Failed to restore project: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        return;
      }

      // Priority 2: Re-open last active project on Tauri startup
      // Awaits directory validation before committing — falls through to
      // URL params if the saved directory no longer exists.
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      const lastActivePath = isTauri ? getLastActiveProject() : null;
      if (lastActivePath) {
        try {
          const { exists } = await import('@tauri-apps/plugin-fs');
          const dirExists = await exists(lastActivePath);
          if (dirExists) {
            actionFired.current = true;
            const { TauriFileSystem } = await import('../../platform/tauriFileSystem');
            const fs = new TauriFileSystem(lastActivePath);
            await useFileStore.getState().openProject(fs);
            // Best-effort: bring window to foreground after last-active restore
            focusCurrentWindow();
            return;
          }
        } catch {
          // Silent failure — fall through to URL params
        }
      }

      // Priority 3: URL params
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      const recentKey = params.get('recent');
      const openPath = params.get('openPath');
      const templateId = params.get('template');
      if (!action && !recentKey && !openPath && !templateId) return;

      actionFired.current = true;

      // Clear the params from the URL so they don't re-trigger on navigation
      params.delete('action');
      params.delete('recent');
      params.delete('openPath');
      params.delete('template');
      const nextSearch = params.toString();
      const nextUrl = window.location.pathname + (nextSearch ? `?${nextSearch}` : '');
      window.history.replaceState({}, '', nextUrl);

      if (openPath) {
        try {
          const { TauriFileSystem } = await import('../../platform/tauriFileSystem');
          const fs = new TauriFileSystem(openPath);
          await useFileStore.getState().openProject(fs);
        } catch (err) {
          useFileStore.setState({
            status: 'error',
            error: `Failed to open project: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } else if (action === 'open') {
        useFileStore.getState().open();
      } else if (templateId) {
        useFileStore.getState().openNewWithTemplate(templateId);
      } else if (recentKey) {
        try {
          const { getHandle } = await import('../../platform/handleStore');
          const handle = await getHandle(recentKey);
          if (!handle) {
            useFileStore.setState({
              status: 'error',
              error: 'Recent project no longer accessible.',
            });
            return;
          }
          const perm = await (handle as any).requestPermission({ mode: 'readwrite' });
          if (perm !== 'granted') {
            useFileStore.setState({
              status: 'error',
              error: 'Permission denied for this project folder.',
            });
            return;
          }
          const { WebFileSystem } = await import('../../platform/webFileSystem');
          const fs = new WebFileSystem(handle);
          await useFileStore.getState().openProject(fs);
        } catch (err) {
          useFileStore.setState({
            status: 'error',
            error: `Failed to open recent project: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    })();
  }, []);

  const fadeUp = (delay: number) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { duration: duration.slow, delay, ease: ease.out },
        };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-8">
        {/* Logo / Heading */}
        <div className="flex flex-col items-center gap-2">
          <motion.img
            src="/favicon.svg"
            alt="ArchCanvas logo"
            width={120}
            height={120}
            className="rounded-3xl"
            {...fadeUp(0)}
          />
          <motion.h1
            className="text-3xl font-bold tracking-tight"
            {...fadeUp(0.08)}
          >
            ArchCanvas
          </motion.h1>
          <motion.p
            className="text-sm text-muted-foreground"
            {...fadeUp(0.16)}
          >
            Open a project folder to get started.
          </motion.p>
        </div>

        {/* Error banner */}
        <AnimatedBanner
          visible={status === 'error' && !!error}
          variant="error"
          className="w-80 rounded-md border px-4 py-3 text-sm"
        >
          <p className="font-medium">Failed to load project</p>
          <p className="mt-1 opacity-80">{error}</p>
        </AnimatedBanner>

        {/* Loading indicator */}
        <AnimatePresence>
          {status === 'loading' && (
            <motion.p
              initial={prefersReduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0 }}
              transition={{ duration: duration.moderate }}
              className="text-sm text-muted-foreground"
            >
              Loading project...
            </motion.p>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <motion.div className="flex flex-col gap-3" {...fadeUp(0.24)}>
          <Shine enableOnHover color="white" opacity={0.15} duration={800}>
            <button
              className="w-64 rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
              onClick={() => useFileStore.getState().open()}
              disabled={status === 'loading'}
            >
              <span>Open{'\u2026'}</span>
              <span className="ml-2 text-xs text-accent-foreground/60">
                {'\u2318'}O
              </span>
            </button>
          </Shine>
        </motion.div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <motion.div className="flex flex-col gap-1 w-64" {...fadeUp(0.32)}>
            <p className="text-xs text-muted-foreground mb-1">Recent</p>
            {recentProjects.map((rp) => (
              <button
                key={rp.path}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent/40 disabled:opacity-50"
                onClick={() => useFileStore.getState().openRecent(rp.path)}
                disabled={status === 'loading'}
              >
                <span className="block truncate">{rp.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{rp.path}</span>
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
