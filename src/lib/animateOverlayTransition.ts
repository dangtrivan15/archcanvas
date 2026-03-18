export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface OverlayAnimationConfig {
  overlayEl: HTMLElement;
  reactFlow: { setViewport(vp: Viewport): void };
  startInset: Inset;
  endInset: Inset;
  startVp: Viewport;
  endVp: Viewport;
  startRadius?: number;
  endRadius?: number;
  duration: number;
  onComplete: () => void;
}

/** Cubic ease-in-out: smooth acceleration then deceleration. */
export function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Animate an overlay's clip-path and viewport simultaneously using requestAnimationFrame.
 * Clip insets and border-radius are interpolated linearly.
 * Viewport x/y are interpolated linearly; zoom is interpolated logarithmically.
 * Returns a cancel function.
 */
export function animateOverlayTransition(config: OverlayAnimationConfig): () => void {
  const {
    overlayEl,
    reactFlow,
    startInset: si,
    endInset: ei,
    startVp,
    endVp,
    startRadius = 8,
    endRadius = 0,
    duration,
    onComplete,
  } = config;

  // Zero duration: apply end state immediately
  if (duration <= 0) {
    overlayEl.style.clipPath =
      `inset(${ei.top}px ${ei.right}px ${ei.bottom}px ${ei.left}px round ${endRadius}px)`;
    reactFlow.setViewport(endVp);
    onComplete();
    return () => {};
  }

  let cancelled = false;
  let startTime: number | null = null;
  let rafHandle: number;
  const sameZoom = startVp.zoom === endVp.zoom;

  function tick(now: number) {
    if (cancelled) return;

    if (startTime === null) {
      startTime = now;
      rafHandle = requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - startTime;
    const rawT = Math.min(elapsed / duration, 1);
    const t = easeInOut(rawT);

    // Clip-path insets + border-radius
    const top = lerp(si.top, ei.top, t);
    const right = lerp(si.right, ei.right, t);
    const bottom = lerp(si.bottom, ei.bottom, t);
    const left = lerp(si.left, ei.left, t);
    const rad = lerp(startRadius, endRadius, t);
    overlayEl.style.clipPath =
      `inset(${top}px ${right}px ${bottom}px ${left}px round ${rad}px)`;

    // Viewport: linear x/y, logarithmic zoom
    const x = lerp(startVp.x, endVp.x, t);
    const y = lerp(startVp.y, endVp.y, t);
    const zoom = sameZoom
      ? startVp.zoom
      : startVp.zoom * Math.pow(endVp.zoom / startVp.zoom, t);
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
