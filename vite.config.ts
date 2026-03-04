import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Enable HTTPS with a self-signed cert in dev mode.
    // Required for File System Access API and Web Crypto on non-localhost.
    ...(process.env.NODE_ENV !== 'test' ? [basicSsl()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.yaml', '**/*.yml'],
  server: {
    host: process.env.VITE_DEV_HOST || 'localhost',
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      },
    },
  },
  build: {
    sourcemap: true,
  },
});
