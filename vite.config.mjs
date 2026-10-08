import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1' },
  build: { outDir: 'dist' },
  esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } } }
});
