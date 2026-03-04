import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Enable HTTPS with a self-signed cert in dev mode.
    // Required for File System Access API and Web Crypto on non-localhost.
    ...(process.env.NODE_ENV !== 'test' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      // Include service worker in dev mode for testing
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: [
        'icons/*.png',
        'icons/*.svg',
        'manifest.json',
      ],
      manifest: false, // Use existing public/manifest.json
      workbox: {
        // Precache app shell: HTML, JS, CSS, fonts, icons
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}',
        ],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Cache .archc files with Cache First strategy (user files)
            urlPattern: /\.archc$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'archc-files',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache YAML node definitions
            urlPattern: /\.(yaml|yml)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'nodedef-files',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache proto files
            urlPattern: /\.proto$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'proto-files',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Allow large JS bundles (app shell) to be precached
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Skip waiting so new SW activates immediately
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
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
