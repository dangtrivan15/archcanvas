import { defineConfig } from 'tsup';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = {
      '@': path.resolve(__dirname, '../src-web'),
    };
  },
  // better-sqlite3 is a native addon, must be external
  external: ['better-sqlite3'],
  // Shared src-web/ code must be bundled into the output
  noExternal: [/^@\/.*/],
});
