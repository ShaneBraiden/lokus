import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const serverDir = path.join(repoRoot, 'server') + path.sep;

// The scoring engine (rubric, answer key, phrase lists) and the simulation content live in server/ and are
// server-only. Fail the build if anything in the client resolves a module from there, however it is imported.
function forbidServerCode(): Plugin {
  return {
    name: 'lokus-forbid-server-code',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source.startsWith('\0') || !importer) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && path.normalize(resolved.id.split('?')[0]).startsWith(serverDir)) {
        throw new Error(`[lokus] ${source} resolves into server/, which is server-only (imported from ${importer})`);
      }
      return resolved;
    },
  };
}

export default defineConfig({
  plugins: [forbidServerCode(), react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(here, 'src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: process.env.LOKUS_API_PROXY ?? 'http://localhost:4000', changeOrigin: false },
    },
    fs: {
      // Only the client and the client-safe shared package may be served by the dev server.
      allow: [path.resolve(here), path.resolve(repoRoot, 'shared'), path.resolve(repoRoot, 'node_modules')],
      deny: ['.env', '.env.*', '**/server/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  },
});
