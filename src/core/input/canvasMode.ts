/**
 * Canvas Mode system — Vim-inspired modal input for ArchCanvas.
 *
 * Modes:
 * - Normal (default): navigate, select nodes, general shortcuts
 * - Connect: create edges between nodes (entered via 'C')
 * - Edit: modify node properties inline (entered via 'i' or Enter on selected node)
 *
 * Mode transitions follow Vim conventions:
 * - Normal → Connect: press 'C'
 * - Normal → Edit: press 'i' or Enter (with node selected)
 * - Connect → Normal: press Escape
 * - Edit → Normal: press Escape
 */

// ─── CanvasMode Enum ─────────────────────────────────────────────

export enum CanvasMode {
  Normal = 'NORMAL',
  Connect = 'CONNECT',
  Edit = 'EDIT',
}

// ─── Transition Rules ────────────────────────────────────────────

export interface ModeTransition {
  from: CanvasMode;
  to: CanvasMode;
  /** Key trigger for this transition (informational, actual handling in keyboard hook) */
  trigger: string;
}

/**
 * Valid mode transitions. Only these transitions are allowed.
 */
export const MODE_TRANSITIONS: ModeTransition[] = [
  { from: CanvasMode.Normal, to: CanvasMode.Connect, trigger: 'C' },
  { from: CanvasMode.Normal, to: CanvasMode.Edit, trigger: 'i' },
  { from: CanvasMode.Normal, to: CanvasMode.Edit, trigger: 'Enter' },
  { from: CanvasMode.Connect, to: CanvasMode.Normal, trigger: 'Escape' },
  { from: CanvasMode.Edit, to: CanvasMode.Normal, trigger: 'Escape' },
];

/**
 * Check whether a transition from one mode to another is valid.
 */
export function isValidTransition(from: CanvasMode, to: CanvasMode): boolean {
  if (from === to) return false;
  return MODE_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/**
 * Get all valid target modes from a given mode.
 */
export function getValidTargets(from: CanvasMode): CanvasMode[] {
  return MODE_TRANSITIONS
    .filter((t) => t.from === from)
    .map((t) => t.to);
}

// ─── Mode Display Metadata ───────────────────────────────────────

export interface ModeDisplayInfo {
  label: string;
  shortLabel: string;
  color: string;        // Tailwind text color class
  bgColor: string;      // Tailwind background color class
  borderColor: string;  // Tailwind border color class
  canvasTint: string;   // Tailwind background class for canvas tint (subtle)
}

export const MODE_DISPLAY: Record<CanvasMode, ModeDisplayInfo> = {
  [CanvasMode.Normal]: {
    label: '-- NORMAL --',
    shortLabel: 'NORMAL',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    canvasTint: '', // no tint in normal mode
  },
  [CanvasMode.Connect]: {
    label: '-- CONNECT --',
    shortLabel: 'CONNECT',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-400',
    canvasTint: 'ring-2 ring-inset ring-blue-300/40',
  },
  [CanvasMode.Edit]: {
    label: '-- EDIT --',
    shortLabel: 'EDIT',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-400',
    canvasTint: 'ring-2 ring-inset ring-amber-300/40',
  },
};

// ─── Mode-specific action prefixes ──────────────────────────────

/**
 * Returns the action prefix for the given mode (e.g., "normal:", "connect:", "edit:").
 * Used by ShortcutManager to filter which actions are available in each mode.
 */
export function getModeActionPrefix(mode: CanvasMode): string {
  switch (mode) {
    case CanvasMode.Normal:
      return 'normal:';
    case CanvasMode.Connect:
      return 'connect:';
    case CanvasMode.Edit:
      return 'edit:';
  }
}

/**
 * Check whether an action ID is available in the given mode.
 * Actions without a mode prefix (e.g., "file:save") are available in ALL modes.
 * Actions with a mode prefix (e.g., "normal:select") are only available in that mode.
 */
export function isActionAvailableInMode(actionId: string, mode: CanvasMode): boolean {
  // Check if the action has a mode prefix
  const modePrefix = getModeActionPrefix(mode);

  // Mode-prefixed actions (normal:*, connect:*, edit:*) are only available in their mode
  if (actionId.startsWith('normal:')) return mode === CanvasMode.Normal;
  if (actionId.startsWith('connect:')) return mode === CanvasMode.Connect;
  if (actionId.startsWith('edit:')) return mode === CanvasMode.Edit;

  // Actions without mode prefix are global (available in all modes)
  return true;
}
