import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('El servidor de produccion no importa Vite al arrancar', async () => {
  const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^import .*from ['"]vite['"]/m);
  assert.match(source, /else\s*\{\s*const \{ createServer: createViteServer \} = await import\('vite'\)/);
});
