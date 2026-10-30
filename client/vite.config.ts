import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

// The scoring engine (rubric, answer key, phrase lists) and the simulation content are server-only.
// Fail the build if anything in the web app tries to import them.
function forbidServerOnlyPackages(): Plugin {
  const forbidden = ['@lokus/engine', '@lokus/content'];
  return {
    name: 'lokus-forbid-server-only',
    enforce: 'pre',
    resolveId(source, importer) {
      if (forbidden.some((p) => source === p || source.startsWith(`${p}/`))) {
        throw new Error(`[lokus] ${source} is server-only and must not be imported by the web app (imported from ${importer})`);
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [forbidServerOnlyPackages(), react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(here, 'src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
    fs: {
      // Only the web app and client-safe packages may be served by the dev server.
      allow: [path.resolve(here), path.resolve(repoRoot, 'packages/shared'), path.resolve(repoRoot, 'node_modules')],
      deny: ['.env', '.env.*', '**/packages/engine/**', '**/packages/content/**', '**/apps/api/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  },
});
