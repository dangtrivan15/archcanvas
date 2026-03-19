import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useNavigationStore } from '@/store/navigationStore';

export function Breadcrumb() {
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const goToBreadcrumb = useNavigationStore((s) => s.goToBreadcrumb);
  const prefersReduced = useReducedMotion();

  return (
    <div data-testid="breadcrumb" className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/80 rounded px-2 py-1 text-sm">
      <AnimatePresence>
        {breadcrumb.map((entry, i) => (
          <motion.span
            key={entry.canvasId}
            className="flex items-center gap-1"
            initial={prefersReduced ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, x: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
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
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
