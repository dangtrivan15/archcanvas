interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface ReactFlowLike {
  setViewport(viewport: Viewport): void;
}

/**
 * Animate between two ReactFlow viewports using requestAnimationFrame.
 * Zoom is interpolated logarithmically for perceptually constant speed.
 * Returns a cancel function.
 */
export function animateViewport(
  reactFlow: ReactFlowLike,
  from: Viewport,
  to: Viewport,
  duration: number,
  easing: (t: number) => number,
  onComplete: () => void,
): () => void {
  let cancelled = false;
  let startTime: number | null = null;
  let rafHandle: number;

  const sameZoom = from.zoom === to.zoom;

  function tick(now: number) {
    if (cancelled) return;

    if (startTime === null) {
      startTime = now;
      rafHandle = requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - startTime;
    const rawT = Math.min(elapsed / duration, 1);
    const t = easing(rawT);

    // Linear interpolation for x, y
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;

    // Logarithmic interpolation for zoom (perceptually constant speed)
    const zoom = sameZoom
      ? from.zoom
      : from.zoom * Math.pow(to.zoom / from.zoom, t);

    reactFlow.setViewport({ x, y, zoom });

    if (rawT >= 1) {
      onComplete();
    } else {
      rafHandle = requestAnimationFrame(tick);
    }
  }

  rafHandle = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafHandle);
  };
}

/** Standard ease-in-out curve. */
export function easeInOut(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
