/**
 * Vite plugin that injects a flash-prevention <script> into index.html.
 *
 * Reads palette data from the TypeScript source files (single source of truth),
 * converts token keys to CSS kebab-case, and generates a synchronous inline
 * script that applies the user's saved theme before first paint.
 */
import type { Plugin } from 'vite';
import { palettes } from './palettes';
import { camelToKebab } from './applyTheme';
import type { ThemeTokens } from './types';

/** Convert a ThemeTokens object to a kebab-case keyed record. */
function tokensToKebab(tokens: ThemeTokens): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    result[camelToKebab(key)] = value;
  }
  return result;
}

/** Build the compact PALETTES object for the inline script. */
function buildPalettesJson(): string {
  const obj: Record<string, { light: Record<string, string>; dark: Record<string, string> }> = {};
  for (const p of palettes) {
    obj[p.id] = {
      light: tokensToKebab(p.light),
      dark: tokensToKebab(p.dark),
    };
  }
  return JSON.stringify(obj);
}

/** Generate the full flash-prevention script content. */
function generateScript(): string {
  const palettesJson = buildPalettesJson();
  return `<script>
(function(){var D={palette:'archcanvas',mode:'light',textSize:'medium'};var S={small:'13px',medium:'15px',large:'17px'};var P=${palettesJson};try{var s=JSON.parse(localStorage.getItem('archcanvas:theme')||'{}');var p=s.palette||D.palette;var m=s.mode||D.mode;var t=s.textSize||D.textSize}catch(e){var p=D.palette;var m=D.mode;var t=D.textSize}var r=m;if(m==='system'){try{r=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){r='light'}}document.documentElement.style.fontSize=S[t]||S.medium;var k=(P[p]||P.archcanvas||{})[r];if(k){for(var n in k){document.documentElement.style.setProperty('--color-'+n,k[n])}}})();
</script>`;
}

export function themeFlashPlugin(): Plugin {
  return {
    name: 'archcanvas-theme-flash',
    transformIndexHtml(html) {
      return html.replace('<!--THEME_FLASH_PREVENTION-->', generateScript());
    },
  };
}
