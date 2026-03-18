/**
 * Deterministic mapping from a node type string to an HSL color.
 * Uses a simple string hash to pick a hue. Saturation and lightness are
 * fixed to produce muted, preview-friendly colors.
 */
export function typeToColor(type: string): string {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = ((hash << 5) - hash + type.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}
