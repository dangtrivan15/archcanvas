/**
 * ModeIndicator - Vim-style status line showing the current canvas mode.
 * Positioned at the bottom-left of the canvas, above the minimap.
 * Displays the current mode (NORMAL, CONNECT, EDIT) with color coding.
 */

import { useUIStore } from '@/store/uiStore';
import { CanvasMode, MODE_DISPLAY } from '@/core/input/canvasMode';

export function ModeIndicator() {
  const canvasMode = useUIStore((s) => s.canvasMode);
  const display = MODE_DISPLAY[canvasMode];

  // Don't show indicator in Normal mode (default state, like Vim)
  if (canvasMode === CanvasMode.Normal) return null;

  return (
    <div
      className={`absolute bottom-24 left-3 z-50 px-3 py-1 rounded-md text-xs font-mono font-bold
        border shadow-sm select-none pointer-events-none
        ${display.bgColor} ${display.color} ${display.borderColor}`}
      data-testid="mode-indicator"
      role="status"
      aria-live="polite"
      aria-label={`Canvas mode: ${display.shortLabel}`}
    >
      {display.label}
    </div>
  );
}
