export function crc16(data, initial = 0) {
  let crc = initial;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc;
}
export function packet(type, command, data = Buffer.alloc(0), number = 0) {
  if (data.length > 4100) throw new Error('Paquete demasiado grande.');
  const buffer = Buffer.alloc(data.length + 10); buffer.writeUInt16LE(0x0fa5); buffer.writeUInt16LE(data.length, 2);
  buffer[4] = type; buffer[5] = command; buffer[6] = number; data.copy(buffer, 7);
  buffer.writeUInt16LE(crc16(buffer.subarray(4, 7 + data.length)), 7 + data.length); buffer[9 + data.length] = 0xff;
  return buffer;
}
export class PacketParser {
  buffer = Buffer.alloc(0);
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]).subarray(-32768); const messages = [];
    while (this.buffer.length >= 10) {
      const head = this.buffer.indexOf(Buffer.from([0xa5, 0x0f]));
      if (head < 0) { this.buffer = this.buffer.subarray(-1); break; }
      this.buffer = this.buffer.subarray(head); if (this.buffer.length < 10) break;
      const size = this.buffer.readUInt16LE(2);
      if (size > 4100) { this.buffer = this.buffer.subarray(1); continue; }
      if (this.buffer.length < size + 10) break;
      const frame = this.buffer.subarray(0, size + 10);
      if (frame.at(-1) === 0xff && frame.readUInt16LE(size + 7) === crc16(frame.subarray(4, size + 7))) {
        messages.push({ type: frame[4], command: frame[5], number: frame[6], data: Buffer.from(frame.subarray(7, size + 7)) }); this.buffer = this.buffer.subarray(size + 10);
      } else this.buffer = this.buffer.subarray(1);
    }
    return messages;
  }
}
