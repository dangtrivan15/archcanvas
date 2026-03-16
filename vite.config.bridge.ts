import { defineConfig, type Plugin } from 'vite';
import { builtinModules } from 'node:module';
import { chmod } from 'node:fs/promises';
import path from 'path';

/**
 * Vite config for building the standalone bridge server as a single ESM Node.js executable.
 *
 * Entry: src/bridge/index.ts
 * Output: dist/bridge-server.js (with #!/usr/bin/env node shebang)
 * Externals: all node:* builtins, Claude SDK, ws, Tauri plugins
 */
function chmodPlugin(): Plugin {
  return {
    name: 'chmod-bridge',
    closeBundle: async () => {
      await chmod(path.resolve(__dirname, 'dist/bridge-server.js'), 0o755);
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
      entry: path.resolve(__dirname, 'src/bridge/index.ts'),
      formats: ['es'],
      fileName: () => 'bridge-server.js',
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        /^@anthropic-ai\//,
        /^ws$/,
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
