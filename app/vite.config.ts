import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Strict CSP only in production builds (dev needs inline scripts for hot reload).
const csp = (): Plugin => ({
  name: 'csp', apply: 'build',
  transformIndexHtml: html => html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https://www.googleapis.com https://www.youtube.com; object-src 'none'; base-uri 'none'" />`)
});

export default defineConfig({
  plugins: [react(), csp()],
  // relative paths + HashRouter so the build works under any sub-path (e.g. GitHub Pages /repo-name/)
  base: './',
  build: { outDir: 'dist' },
  server: { port: 5173, strictPort: true },
  test: { include: ['tests/**/*.test.ts'] }
} as any);
