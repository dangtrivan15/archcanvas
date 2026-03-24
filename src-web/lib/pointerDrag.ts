import { getReactFlowInstance } from './reactFlowRef';
import { useNavigationStore } from '@/store/navigationStore';
import { createNodeFromType } from './createNodeFromType';

const CANVAS_SELECTOR = '[data-testid="main-canvas"]';

interface DragState {
  typeKey: string;
  ghost: HTMLElement;
  startX: number;
  startY: number;
  moved: boolean;
  onMove: (e: PointerEvent) => void;
  onUp: (e: PointerEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

let active: DragState | null = null;

/** Whether a pointer drag is currently in progress. */
export function isDragging(): boolean {
  return active !== null;
}

function cleanup(): void {
  if (!active) return;
  active.ghost.remove();
  document.removeEventListener('pointermove', active.onMove);
  document.removeEventListener('pointerup', active.onUp);
  document.removeEventListener('pointercancel', active.onUp);
  document.removeEventListener('keydown', active.onKeyDown);
  document.body.classList.remove('dragging');
  active = null;
}

function createGhost(displayName: string): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'archcanvas-drag-ghost';
  ghost.textContent = displayName;
  Object.assign(ghost.style, {
    position: 'fixed',
    zIndex: '9999',
    pointerEvents: 'none',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'inherit',
    background: 'var(--color-accent)',
    color: 'var(--color-accent-foreground, #fff)',
    opacity: '0.9',
    whiteSpace: 'nowrap',
    transform: 'translate(-50%, -50%)',
    display: 'none',
  });
  document.body.appendChild(ghost);
  return ghost;
}

// Minimum distance (px) before the gesture is treated as a drag
const DRAG_THRESHOLD = 5;

/**
 * Start a pointer-based drag from a node type item.
 * Call this from onPointerDown on the type item element.
 */
export function startDrag(
  typeKey: string,
  displayName: string,
  e: PointerEvent,
): void {
  // Clean up any stale drag (shouldn't happen, but defensive)
  if (active) cleanup();

  const ghost = createGhost(displayName);
  const startX = e.clientX;
  const startY = e.clientY;

  const onMove = (me: PointerEvent) => {
    if (!active) return;
    if (!active.moved) {
      const dx = me.clientX - active.startX;
      const dy = me.clientY - active.startY;
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      active.moved = true;
      active.ghost.style.display = 'block';
    }
    active.ghost.style.left = `${me.clientX}px`;
    active.ghost.style.top = `${me.clientY}px`;
  };

  const onUp = (ue: PointerEvent) => {
    const wasMoved = active?.moved ?? false;
    const ghostWasVisible = active?.ghost.style.display === 'block';

    // Clean up before creating node (so ghost doesn't interfere with elementFromPoint)
    cleanup();

    // Only process as a drop if the user actually dragged
    if (!wasMoved || !ghostWasVisible) return;

    // Check if pointer is over the canvas
    const target = document.elementFromPoint(ue.clientX, ue.clientY);
    const canvas = target?.closest(CANVAS_SELECTOR);
    if (!canvas) return;

    const rf = getReactFlowInstance();
    if (!rf) return;

    const position = rf.screenToFlowPosition({
      x: ue.clientX,
      y: ue.clientY,
    });

    const canvasId = useNavigationStore.getState().currentCanvasId;
    createNodeFromType(canvasId, typeKey, position);
  };

  const onKeyDown = (ke: KeyboardEvent) => {
    if (ke.key === 'Escape') {
      cleanup();
    }
  };

  active = { typeKey, ghost, startX, startY, moved: false, onMove, onUp, onKeyDown };

  // Prevent native text selection during drag (fixes WKWebView/Tauri blue highlight)
  document.body.classList.add('dragging');

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
  document.addEventListener('keydown', onKeyDown);
}

/** Cancel an in-progress drag (e.g., on Escape or overlay close). */
export function cancelDrag(): void {
  cleanup();
}
