import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useRegistryStore } from '@/store/registryStore';
import { useNavigationStore } from '@/store/navigationStore';
import { createNodeFromType } from '@/lib/createNodeFromType';
import { resolveIcon } from '@/components/nodes/iconMap';

interface NodeTypeOverlayProps {
  visible: boolean;
  pinned: boolean;
  onPin: (pinned: boolean) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function NodeTypeOverlay({
  visible,
  pinned,
  onPin,
  onMouseEnter,
  onMouseLeave,
}: NodeTypeOverlayProps) {
  const [filter, setFilter] = useState('');
  const prefersReduced = useReducedMotion();

  const types = useMemo(() => {
    const store = useRegistryStore.getState();
    const defs = filter ? store.search(filter) : store.list();
    // Group by namespace, preserving order
    const grouped = new Map<string, typeof defs>();
    for (const def of defs) {
      const ns = def.metadata.namespace;
      if (!grouped.has(ns)) grouped.set(ns, []);
      grouped.get(ns)!.push(def);
    }
    return grouped;
  }, [filter]);

  const handleClick = useCallback(
    (typeKey: string) => {
      const canvasId = useNavigationStore.getState().currentCanvasId;
      createNodeFromType(canvasId, typeKey);
    },
    [],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, typeKey: string) => {
      e.dataTransfer.setData('application/archcanvas-nodetype', typeKey);
      e.dataTransfer.effectAllowed = 'copy';
      onPin(true);
    },
    [onPin],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="node-type-overlay"
          data-pinned={pinned ? 'true' : undefined}
          className="absolute left-12 top-0 z-30 w-[260px] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl"
          style={{
            borderColor: pinned ? 'var(--color-accent)' : 'var(--color-border)',
            maxHeight: 'calc(100vh - 32px)',
          }}
          initial={prefersReduced ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReduced ? undefined : { opacity: 0, x: -8 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Node Types
            </span>
            {pinned && (
              <span className="text-[10px] text-accent">pinned</span>
            )}
          </div>

          {/* Filter */}
          <div className="px-2 py-1.5">
            <input
              placeholder="Filter types..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground outline-none placeholder:text-muted-foreground focus:border-accent"
            />
          </div>

          {/* Type list */}
          <div className="overflow-y-auto px-1.5 pb-2" style={{ maxHeight: 'calc(100vh - 120px)' }}>
            {Array.from(types.entries()).map(([namespace, defs]) => (
              <div key={namespace}>
                <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {namespace}
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {defs.map((def) => {
                    const typeKey = `${def.metadata.namespace}/${def.metadata.name}`;
                    const Icon = resolveIcon(def.metadata.icon);
                    return (
                      <div
                        key={typeKey}
                        data-testid="node-type-item"
                        data-type={typeKey}
                        draggable
                        onClick={() => handleClick(typeKey)}
                        onDragStart={(e) => handleDragStart(e, typeKey)}
                        className="flex cursor-grab items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
                      >
                        <span className="shrink-0 text-sm" aria-hidden>
                          {Icon ? <Icon className="h-3.5 w-3.5" /> : '◻'}
                        </span>
                        <span className="truncate">
                          {def.metadata.displayName ?? def.metadata.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {types.size === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No types match filter.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
