/**
 * Node.js ESM Loader Hooks for YAML files.
 *
 * Handles Vite-style `?raw` imports of YAML files in Node.js environments.
 * When a module imports `foo.yaml?raw`, this loader:
 *   1. Strips the `?raw` query from the specifier
 *   2. Reads the YAML file from disk
 *   3. Returns the raw text as the default export (matching Vite's behavior)
 *
 * This enables the existing loader.ts (which uses Vite ?raw imports) to work
 * unchanged in CLI/Node.js environments via tsx.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Resolve hook: strip `?raw` from YAML import specifiers so Node.js
 * can find the actual file on disk.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.yaml?raw') || specifier.endsWith('.yml?raw')) {
    // Strip ?raw and resolve the plain file path
    const cleanSpecifier = specifier.replace('?raw', '');
    const resolved = await nextResolve(cleanSpecifier, context);
    // Tag the URL so the load hook knows this was a ?raw import
    return {
      ...resolved,
      url: resolved.url + '?raw',
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

/**
 * Load hook: for YAML files (tagged with ?raw), read the file content
 * and return it as a JavaScript module with a default string export.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith('.yaml?raw') || url.endsWith('.yml?raw')) {
    // Strip ?raw to get the real file URL
    const cleanUrl = url.replace('?raw', '');
    const filePath = fileURLToPath(cleanUrl);
    const content = readFileSync(filePath, 'utf-8');
    return {
      format: 'module',
      source: `export default ${JSON.stringify(content)};`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
