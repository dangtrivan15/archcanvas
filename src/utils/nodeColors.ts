/**
 * Default color mappings for node types.
 * Each node type namespace gets a distinct default color to make
 * different node types visually distinguishable at a glance.
 *
 * Colors can be overridden per-node via position.color (persisted in .archc file).
 */

/** Predefined color palette for the color picker UI */
export const NODE_COLOR_PALETTE = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Rose', value: '#F43F5E' },
] as const;

/** Default colors per specific node type (most specific match) */
const NODE_TYPE_COLOR_MAP: Record<string, string> = {
  'compute/service': '#3B82F6',       // Blue
  'compute/function': '#6366F1',      // Indigo
  'compute/worker': '#8B5CF6',        // Purple
  'compute/api-gateway': '#06B6D4',   // Cyan
  'data/database': '#10B981',         // Green
  'data/cache': '#14B8A6',            // Teal
  'data/object-storage': '#84CC16',   // Lime
  'data/repository': '#059669',       // Emerald
  'messaging/message-queue': '#F59E0B', // Amber/Orange
  'messaging/event-bus': '#D97706',   // Darker amber
  'messaging/stream-processor': '#EA580C', // Deep orange
  'network/load-balancer': '#8B5CF6', // Purple
  'network/cdn': '#A855F7',           // Light purple
  'network/dns': '#7C3AED',           // Violet
  'observability/logging': '#06B6D4', // Cyan
  'observability/monitoring': '#0891B2', // Darker cyan
};

/** Fallback colors per namespace (when no specific type match) */
const NAMESPACE_COLOR_FALLBACK: Record<string, string> = {
  compute: '#3B82F6',     // Blue
  data: '#10B981',        // Green
  messaging: '#F59E0B',   // Orange
  network: '#8B5CF6',     // Purple
  observability: '#06B6D4', // Cyan
};

/** Default color when no type or namespace match */
const DEFAULT_NODE_COLOR = '#6B7280'; // Gray

/**
 * Get the default color for a node type.
 * Priority: exact type match > namespace match > global default.
 */
export function getDefaultNodeColor(nodeType: string): string {
  // Exact type match
  if (NODE_TYPE_COLOR_MAP[nodeType]) {
    return NODE_TYPE_COLOR_MAP[nodeType];
  }

  // Namespace fallback
  const namespace = nodeType.split('/')[0] ?? '';
  if (namespace && NAMESPACE_COLOR_FALLBACK[namespace]) {
    return NAMESPACE_COLOR_FALLBACK[namespace];
  }

  return DEFAULT_NODE_COLOR;
}

/**
 * Get the effective color for a node.
 * Uses custom color (position.color) if set, otherwise falls back to type default.
 */
export function getEffectiveNodeColor(customColor: string | undefined, nodeType: string): string {
  if (customColor && customColor.trim()) {
    return customColor;
  }
  return getDefaultNodeColor(nodeType);
}

/**
 * Convert a hex color to a lighter background variant (with alpha).
 * Used for node header backgrounds.
 */
export function colorToBackground(hexColor: string, alpha: number = 0.12): string {
  return `${hexColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

/**
 * Convert a hex color to a border variant (with alpha).
 */
export function colorToBorder(hexColor: string, alpha: number = 0.5): string {
  return `${hexColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

/**
 * Parse a hex color string to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1]!, 16), g: parseInt(result[2]!, 16), b: parseInt(result[3]!, 16) }
    : null;
}

/**
 * Generate a color-tinted CSS box-shadow string for a node.
 * Returns a soft drop shadow tinted with the node's accent color.
 * @param hexColor - The accent color in hex (e.g., '#3B82F6')
 * @param elevation - 'default' for subtle shadow, 'hover' for more prominent
 */
export function colorTintedShadow(hexColor: string, elevation: 'default' | 'hover' = 'default'): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return elevation === 'default' ? '0 1px 3px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.15)';
  const { r, g, b } = rgb;
  if (elevation === 'hover') {
    return `0 4px 12px rgba(${r},${g},${b},0.25), 0 2px 4px rgba(${r},${g},${b},0.15)`;
  }
  return `0 2px 8px rgba(${r},${g},${b},0.18), 0 1px 3px rgba(${r},${g},${b},0.10)`;
}

/**
 * Convert a hex color to normalized RGB values (0-1 range) for SVG filters.
 */
/**
 * Generate a soft glow/halo CSS box-shadow for selected nodes.
 * Uses the node's accent color to create a diffused, premium selection indicator.
 */
export function colorGlowShadow(hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '0 0 12px 4px rgba(107,114,128,0.35), 0 0 4px 1px rgba(107,114,128,0.25)';
  const { r, g, b } = rgb;
  return `0 0 14px 4px rgba(${r},${g},${b},0.35), 0 0 6px 2px rgba(${r},${g},${b},0.25), 0 0 2px 1px rgba(${r},${g},${b},0.18)`;
}

export function hexToNormalizedRgb(hexColor: string): { r: number; g: number; b: number } {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return { r: 0.42, g: 0.42, b: 0.42 }; // gray fallback
  return { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };
}

/**
 * Calculate the relative luminance of a hex color per WCAG 2.0.
 * Returns a value between 0 (black) and 1 (white).
 */
export function getRelativeLuminance(hexColor: string): number {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 0.5;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/**
 * Get the best contrast text/icon color for a given background color.
 * Returns white for dark backgrounds and a dark color for light backgrounds.
 * Uses WCAG luminance threshold to ensure sufficient contrast (≥ 3:1).
 */
export function getContrastColor(hexColor: string): string {
  const luminance = getRelativeLuminance(hexColor);
  // Threshold: if luminance > 0.35, background is "light" → use dark text
  // Using 0.35 instead of 0.179 for better visual results with saturated colors
  return luminance > 0.35 ? '#1a1a2e' : '#ffffff';
}
