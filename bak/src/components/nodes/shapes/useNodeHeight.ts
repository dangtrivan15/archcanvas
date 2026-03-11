/**
 * useNodeHeight - Hook to measure a node's rendered height via ResizeObserver.
 *
 * Used by shaped nodes to compute shape-aware handle positions that depend
 * on the actual rendered height (e.g., cylinder caps, document wave).
 */

import { useRef, useState, useEffect, type RefObject } from 'react';

const DEFAULT_HEIGHT = 80;

/**
 * Returns a ref to attach to the outer wrapper div and the measured height.
 * The height updates when the element resizes.
 */
export function useNodeHeight(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial measurement
    const rect = el.getBoundingClientRect();
    if (rect.height > 0) {
      setHeight(rect.height);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.ceil(entry.contentRect.height);
        if (h > 0) setHeight(h);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, height];
}
