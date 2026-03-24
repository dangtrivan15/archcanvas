import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useFileStore } from '@/store/fileStore';
import { Shine } from '@/components/ui/shine';

/**
 * Full-screen gate shown when no project is open (fileStore.fs === null).
 *
 * Provides a single "Open…" action that picks a directory. The system
 * auto-detects new vs existing projects by checking for .archcanvas/main.yaml.
 *
 * Shows error state if the last open attempt failed.
 *
 * Handles URL param for multi-tab flow:
 * - ?action=open — auto-fires open() on mount
 */
export function ProjectGate() {
  const status = useFileStore((s) => s.status);
  const error = useFileStore((s) => s.error);
  const actionFired = useRef(false);
  const prefersReduced = useReducedMotion();

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
    }
  }, []);

  const fadeUp = (delay: number) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: { duration: 0.35, delay, ease: 'easeOut' as const },
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
        <AnimatePresence>
          {status === 'error' && error && (
            <motion.div
              role="alert"
              initial={prefersReduced ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-80 rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              <p className="font-medium">Failed to load project</p>
              <p className="mt-1 text-red-400/80">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading indicator */}
        <AnimatePresence>
          {status === 'loading' && (
            <motion.p
              initial={prefersReduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2 }}
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
      </div>
    </div>
  );
}
