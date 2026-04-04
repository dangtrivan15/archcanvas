/**
 * Decode a data URL to a text string.
 *
 * Handles both URI-encoded and base64 data URLs:
 *   - `data:image/svg+xml;charset=utf-8,%3Csvg...` → decodeURIComponent
 *   - `data:image/svg+xml;base64,PHN2Zz4...`      → atob
 *
 * This is important because html-to-image typically returns URI-encoded
 * SVG data URLs, but the encoding may vary across library versions or
 * browser implementations.
 */
export function decodeDataUrl(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Invalid data URL: missing comma separator');
  }

  const header = dataUrl.substring(0, commaIdx);
  const payload = dataUrl.substring(commaIdx + 1);

  if (header.includes(';base64')) {
    return atob(payload);
  }

  return decodeURIComponent(payload);
}
