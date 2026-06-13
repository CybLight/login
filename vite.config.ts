import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      path: path.resolve(__dirname, './src/shims/node-empty.ts'),
      fs: path.resolve(__dirname, './src/shims/node-empty.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    open: true,
    port: 5173,
    // Proxy API requests to avoid CORS in development
    proxy: {
      '/api': {
        target: 'https://api.cyblight.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
});
