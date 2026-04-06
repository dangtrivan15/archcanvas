import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDiffStore } from "@/store/diffStore";

/**
 * Floating filter bar shown when diff overlay is active.
 * Allows toggling visibility of added / removed / modified items.
 */
export function DiffFilterBar() {
  const enabled = useDiffStore((s) => s.enabled);
  const filter = useDiffStore((s) => s.filter);
  const setFilter = useDiffStore((s) => s.setFilter);
  const baseRef = useDiffStore((s) => s.baseRef);
  const disable = useDiffStore((s) => s.disable);
  const prefersReduced = useReducedMotion();

  return (
    <AnimatePresence>
      {enabled && (
        <motion.div
          data-testid="diff-filter-bar"
          initial={prefersReduced ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReduced ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-lg border border-border bg-popover/95 backdrop-blur-sm px-3 py-1.5 shadow-lg text-xs"
        >
          <span className="font-medium text-popover-foreground mr-1">
            Diff vs {baseRef}
          </span>

          <FilterToggle
            label="Added"
            checked={filter.showAdded}
            color="bg-green-500"
            onChange={(v) => setFilter({ showAdded: v })}
          />
          <FilterToggle
            label="Removed"
            checked={filter.showRemoved}
            color="bg-red-500"
            onChange={(v) => setFilter({ showRemoved: v })}
          />
          <FilterToggle
            label="Modified"
            checked={filter.showModified}
            color="bg-yellow-500"
            onChange={(v) => setFilter({ showModified: v })}
          />

          <button
            className="ml-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => disable()}
            title="Close diff overlay"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FilterToggle({
  label,
  checked,
  color,
  onChange,
}: {
  label: string;
  checked: boolean;
  color: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
        checked
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50'
      }`}
      onClick={() => onChange(!checked)}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${color} ${checked ? '' : 'opacity-30'}`} />
      {label}
    </button>
  );
}
