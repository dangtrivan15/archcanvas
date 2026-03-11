import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'esbuild';

/**
 * esbuild plugin that handles Vite-style `?raw` YAML imports.
 * Reads the file contents and exports them as a default string.
 */
function yamlRawPlugin(): Plugin {
  return {
    name: 'yaml-raw',
    setup(build) {
      // Resolve ?raw imports - strip the ?raw suffix
      build.onResolve({ filter: /\.yaml\?raw$/ }, (args) => {
        const filePath = resolve(args.resolveDir, args.path.replace('?raw', ''));
        return { path: filePath, namespace: 'yaml-raw' };
      });

      // Load the YAML file as a raw string
      build.onLoad({ filter: /.*/, namespace: 'yaml-raw' }, (args) => {
        const content = readFileSync(args.path, 'utf-8');
        return {
          contents: `export default ${JSON.stringify(content)};`,
          loader: 'js',
        };
      });
    },
  };
}

export default defineConfig({
  entry: ['src/cli/index.ts'],
  outDir: 'dist/cli',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
  // Bundle protobufjs into CLI (CJS subpath exports don't resolve in ESM)
  noExternal: ['protobufjs'],
  // Keep other npm packages external - they'll be installed via package.json dependencies
  external: [
    // Browser-only packages (should NOT be in CLI at all)
    'react',
    'react-dom',
    'html-to-image',
    '@xyflow/react',
    'elkjs',
    'elkjs/lib/elk.bundled.js',
    '@capacitor/core',
    '@capacitor/filesystem',
    '@capacitor/share',
    '@capawesome/capacitor-file-picker',
    '@capacitor/clipboard',
    '@capacitor/preferences',
    '@capacitor/app',
    '@capacitor/ios',
    'lucide-react',
    'zustand',
    // npm dependencies needed at runtime (kept external, installed via package.json)
    'commander',
    'yaml',
    'zod',
    // Note: protobufjs is intentionally NOT external - it's bundled because
    // its CJS subpath exports (protobufjs/minimal) don't resolve in ESM
    'js-sha256',
    'ulid',
    'marked',
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/server/mcp.js',
    '@modelcontextprotocol/sdk/server/stdio.js',
  ],
  // Copy nodedef YAML files so nodeLoader can find them at runtime
  // nodeLoader resolves: dirname(import.meta.url)/../core/registry/builtins/core
  // When bundled to dist/cli/, that resolves to dist/core/registry/builtins/core
  onSuccess: 'mkdir -p dist/core/registry && cp -r src/core/registry/builtins dist/core/registry/',
  // Note: shebang is already in src/cli/index.ts, esbuild preserves it
  esbuildPlugins: [yamlRawPlugin()],
  esbuildOptions(options) {
    // Resolve @/ path alias
    options.alias = {
      '@': './src',
    };
  },
});
