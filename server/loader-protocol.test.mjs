import test from 'node:test';
import assert from 'node:assert/strict';
import { crc16, packet, PacketParser } from './loader-protocol.mjs';

test('CRC-16 CCITT con vector conocido', () => {
  assert.equal(crc16(Buffer.from('123456789')), 0x31c3);
});
test('Recupera paquetes fragmentados en cada limite', () => {
  const data = Buffer.from([0x4e, 0, 0, 0]); const bytes = packet(0xa2, 0x85, data, 1);
  for (let split = 1; split < bytes.length; split++) {
    const parser = new PacketParser();
    assert.deepEqual(parser.push(bytes.subarray(0, split)), []);
    assert.deepEqual(parser.push(bytes.subarray(split)), [{ type: 0xa2, command: 0x85, number: 1, data }]);
  }
});
test('Descarta CRC alterado, ruido y cola invalida', () => {
  const valid = packet(0xa2, 0x05); const bad = Buffer.from(valid); bad[7] ^= 1;
  const wrongTail = Buffer.from(valid); wrongTail[9] = 0;
  const parser = new PacketParser();
  assert.equal(parser.push(Buffer.concat([Buffer.from('ruido'), bad, wrongTail, valid])).length, 1);
});
test('Paquetes concatenados y tamaño maximo', () => {
  const parser = new PacketParser();
  const bytes = packet(0xa2, 0x08, Buffer.alloc(4100, 0x55));
  assert.equal(parser.push(Buffer.concat([bytes, packet(0xa1, 0x09)])).length, 2);
  assert.throws(() => packet(0xa2, 0x08, Buffer.alloc(4101)));
});
