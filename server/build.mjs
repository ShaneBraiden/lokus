// Bundles the API for production. Workspace packages (@lokus/*) and the server's own subpath imports
// (#engine, #content) are TypeScript sources, so they are bundled in; every other bare import stays
// external and is resolved from node_modules at runtime.
import { build } from 'esbuild';

const externalizeNpmDeps = {
  name: 'externalize-npm-deps',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@lokus/') || args.path.startsWith('#')) return undefined;
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  jsx: 'automatic',
  plugins: [externalizeNpmDeps],
  logLevel: 'info',
});
