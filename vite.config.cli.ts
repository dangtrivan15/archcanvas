import { defineConfig, type Plugin } from 'vite';
import { builtinModules } from 'node:module';
import { chmod } from 'node:fs/promises';
import path from 'path';

/**
 * Vite config for building the CLI as a single ESM Node.js executable.
 *
 * Entry: src/cli/index.ts
 * Output: dist/cli.js (with #!/usr/bin/env node shebang)
 * Externals: all node:* builtins
 * Bundles: commander, yaml, zod, immer, zustand, and all src/ imports
 */
function chmodPlugin(): Plugin {
  return {
    name: 'chmod-cli',
    closeBundle: async () => {
      await chmod(path.resolve(__dirname, 'dist/cli.js'), 0o755);
    },
  };
}

export default defineConfig({
  plugins: [chmodPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'node20',
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/cli/index.ts'),
      formats: ['es'],
      fileName: () => 'cli.js',
    },
    rollupOptions: {
      external: [
        // Externalize all Node.js builtins (with and without node: prefix)
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        // Externalize Tauri plugins — only available inside Tauri webview,
        // dynamically imported and never reached in CLI context
        /^@tauri-apps\//,
      ],
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
    minify: false,
    sourcemap: false,
  },
});
