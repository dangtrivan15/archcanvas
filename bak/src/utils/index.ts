/**
 * Utilities barrel export.
 */

// ID generation
export { generateId } from './idGenerator';

// Time formatting
export { formatRelativeTime } from './formatRelativeTime';

// HTML sanitization
export { sanitizeHtml } from './sanitizeHtml';

// Node color utilities
export {
  NODE_COLOR_PALETTE,
  getDefaultNodeColor,
  getEffectiveNodeColor,
  colorToBackground,
  colorToBorder,
  colorTintedShadow,
  colorGlowShadow,
  hexToNormalizedRgb,
  getRelativeLuminance,
  getContrastColor,
} from './nodeColors';

// Constants
export {
  MAGIC_BYTES,
  FORMAT_VERSION,
  FILE_EXTENSION,
  SIDECAR_EXTENSION,
  MAX_UNDO_ENTRIES,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  GRID_SIZE,
  MIN_ZOOM,
  MAX_ZOOM,
  FIT_VIEW_PADDING,
  DEFAULT_NODE_SPACING_X,
  DEFAULT_NODE_SPACING_Y,
  NODEDEF_NAMESPACES,
  RIGHT_PANEL_TABS,
  DEFAULT_ARCHITECTURE_NAME,
} from './constants';

export type { NodeDefNamespace, RightPanelTab } from './constants';
