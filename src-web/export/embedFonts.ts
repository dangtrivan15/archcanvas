/**
 * Embed fonts as base64 `@font-face` rules for export.
 *
 * When `html-to-image` generates an SVG, external font references break
 * because the SVG is rendered in a detached context (data URL or foreignObject).
 * This module fetches the font files, encodes them as base64, and injects
 * `@font-face` declarations directly into the cloned DOM.
 *
 * Fonts embedded:
 *  - Inter (variable weight) — used for all UI text
 *  - Monaspace Argon (Regular + Medium) — used for code/type labels
 */

interface FontSpec {
  family: string;
  weight: string;
  style: string;
  url: string;
}

/**
 * The fonts used by ArchCanvas. Paths are relative to the public directory.
 */
const FONT_SPECS: FontSpec[] = [
  {
    family: 'Inter',
    weight: '100 700',
    style: 'normal',
    url: '/fonts/inter/InterVariable.woff2',
  },
  {
    family: 'Monaspace Argon',
    weight: '400',
    style: 'normal',
    url: '/fonts/monaspace-argon/MonaspaceArgon-Regular.woff2',
  },
  {
    family: 'Monaspace Argon',
    weight: '500',
    style: 'normal',
    url: '/fonts/monaspace-argon/MonaspaceArgon-Medium.woff2',
  },
];

/**
 * Fetch a font file and return it as a base64 data URL.
 * Returns null if the fetch fails (font embedding is best-effort).
 */
async function fetchFontAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:font/woff2;base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Embed all project fonts as base64 `@font-face` rules inside a `<style>`
 * element and inject it into the given container.
 *
 * Font fetches run concurrently. Failures are silently skipped — the export
 * will still work, just with fallback fonts.
 */
export async function embedFonts(container: HTMLElement): Promise<void> {
  const results = await Promise.all(
    FONT_SPECS.map(async (spec) => {
      const dataUrl = await fetchFontAsBase64(spec.url);
      if (!dataUrl) return null;
      return `@font-face {
  font-family: '${spec.family}';
  font-style: ${spec.style};
  font-weight: ${spec.weight};
  font-display: swap;
  src: url('${dataUrl}') format('woff2');
}`;
    }),
  );

  const rules = results.filter(Boolean).join('\n');
  if (!rules) return;

  const style = document.createElement('style');
  style.textContent = rules;
  container.insertBefore(style, container.firstChild);
}
