import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/app/server.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  external: ['better-sqlite3'],
});
