import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src-landing'),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, 'dist-landing'),
    emptyOutDir: true,
  },
});
