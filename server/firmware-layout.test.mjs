import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { validateUserCode } from './firmware-layout.mjs';
test('El codigo empaquetado contiene ambos nucleos, no el binario crudo', { skip: !existsSync('output/user-code.bin') }, async () => {
  validateUserCode(await readFile('output/user-code.bin'));
});
test('El codigo crudo de un solo nucleo se rechaza', async () => {
  assert.throws(() => validateUserCode(awaitBuffer), /dos nucleos/);
});
const awaitBuffer = Buffer.from([0x6f, 0, 0xc0, 0x13, ...Array(60).fill(0)]);
import fs from 'node:fs/promises';
test('Los modelos estan en las direcciones anunciadas al procesador', { skip: !existsSync('output/fw.bin') || !existsSync('vendor/asrpro/asr/asr.bin') }, async () => {
  const image = await fs.readFile('output/fw.bin');
  for (const [index, name] of [[0, 'user_code/user_code.bin'], [2, 'asr/asr.bin'], [3, 'dnn/dnn.bin'], [4, 'voice/voice.bin'], [5, 'user_file/user_file.bin']]) {
    const data = await fs.readFile('vendor/asrpro/' + name);
    const address = image.readUInt32LE(0x2000 + 166 + index * 17 + 4);
    assert.ok(image.subarray(address, address + data.length).equals(data), 'Particion desplazada: ' + name);
  }
});
test('La tabla empaquetada coincide con los comandos recien compilados', { skip: !existsSync('vendor/asrpro/user_file/user_file.bin') }, async () => {
  const packed = await fs.readFile('vendor/asrpro/user_file/user_file.bin');
  const generated = await fs.readFile('vendor/asrpro/user_file/cmd_info/[60000]{cmd_info}.xlsx.bin');
  const count = packed.readUInt16LE(0);
  let actual;
  for (let i = 0; i < count; i++) {
    const entry = 2 + i * 10;
    if (packed.readUInt16LE(entry) === 60000) {
      const start = packed.readUInt32LE(entry + 2);
      actual = packed.subarray(start, start + packed.readUInt32LE(entry + 6));
    }
  }
  assert.deepEqual(actual, generated);
});
