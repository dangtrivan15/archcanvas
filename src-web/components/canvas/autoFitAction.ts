import type { Viewport } from '@/store/navigationStore';

// ---------------------------------------------------------------------------
// Auto-fit decision logic — pure function for testability
// ---------------------------------------------------------------------------

export type AutoFitAction =
  | { type: 'skip' }
  | { type: 'fitView' }
  | { type: 'restoreViewport'; viewport: Viewport };

/**
 * Determines what viewport action to take when the Canvas first mounts.
 *
 * This is the single source of truth for the auto-fit decision. The Canvas
 * effect calls this and blindly executes the result.
 *
 * @param hasFitted        Whether auto-fit has already fired this mount cycle
 * @param nodeCount        Current number of nodes in the canvas
 * @param mountedWithNodes Whether nodes were present when the component first
 *                         mounted — `true` means nodes came from project load
 *                         (Canvas mounts after store is populated), `false`
 *                         means the canvas mounted empty and nodes appeared
 *                         later via interactive creation.
 * @param savedViewport    Previously saved viewport for this canvas (set by
 *                         dive-in / go-up navigation)
 */
export function resolveAutoFitAction(
  hasFitted: boolean,
  nodeCount: number,
  mountedWithNodes: boolean,
  savedViewport: Viewport | undefined,
): AutoFitAction {
  // Already fired once this mount — don't interfere with user panning
  if (hasFitted) return { type: 'skip' };

  // No nodes to frame
  if (nodeCount === 0) return { type: 'skip' };

  // Component mounted with an empty canvas — nodes appeared later via
  // interactive creation (addNode). Don't auto-fit or the viewport would
  // jump and zoom unexpectedly.
  if (!mountedWithNodes) return { type: 'skip' };

  // A previous navigation (dive-in / go-up) saved a viewport for this
  // canvas — restore it for a seamless back-and-forth experience.
  if (savedViewport) return { type: 'restoreViewport', viewport: savedViewport };

  // Fresh canvas with nodes loaded from disk — fit everything into view.
  return { type: 'fitView' };
}
