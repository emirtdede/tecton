import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Content Security Policy, injected into the production HTML only.
//
// It is added at build time (not as a static meta tag) because the dev server
// needs inline scripts and a WebSocket for HMR; baking this policy into the
// source HTML would break `vite dev`.
//
// - script-src 'self'      : only the bundled JS may execute (no inline XSS).
// - style-src includes 'unsafe-inline' because React uses inline style props
//   and index.css imports Google Fonts.
// - img-src allows data:/blob: (compressed photos, PDF canvases) and the
//   OpenWeather icon CDN.
// - connect-src 'self'     : renderer talks to the main process, not the net.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://openweathermap.org",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function productionCspPlugin() {
  return {
    name: 'tecton-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), productionCspPlugin()],
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // The whole renderer used to ship as a single ~3.15 MB chunk. Splitting the
    // heavy, rarely-changing vendor libraries lets the browser cache them
    // separately and keeps the app chunk small.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Only libraries that the first paint needs are pinned to a named
          // chunk. PDF/Excel libraries are reached exclusively through dynamic
          // import(), so Rollup emits them as their own on-demand chunks; naming
          // them here used to pull Vite's preload helper into the pdf chunk and
          // the entry then preloaded 610 kB of jspdf on every launch.
          if (id.includes('react-dom') || /[\\/]react[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('i18next')) return 'vendor-i18n';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
    },
  },
});
