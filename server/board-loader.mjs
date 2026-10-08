import { SerialPort } from 'serialport';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { crc16, packet, PacketParser } from './loader-protocol.mjs';
import { validateUserCode } from './firmware-layout.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = fn => new Promise((resolve, reject) => fn(error => error ? reject(error) : resolve()));
function officialAgent(executable) {
  const pe = executable.readUInt32LE(60);
  const sections = executable.readUInt16LE(pe + 6);
  const table = pe + 24 + executable.readUInt16LE(pe + 20);
  for (let i = 0; i < sections; i++) {
    const entry = table + i * 40;
    const address = executable.readUInt32LE(entry + 12);
    const length = executable.readUInt32LE(entry + 16);
    const offset = executable.readUInt32LE(entry + 20);
    if (0x14e64 >= address && 0x14e64 + 0x3f0c <= address + length) {
      const agent = executable.subarray(offset + 0x14e64 - address, offset + 0x14e64 - address + 0x3f0c);
      if (createHash('sha256').update(agent).digest('hex') !== '6c3634740cf6b1c8edfa6dd0c5e864610436037f0c214dca3b5933f814647436') throw new Error('Agente oficial desconocido.');
      return agent;
    }
  }
  throw new Error('No se encuentra el agente del programador oficial.');
}

export class BoardLoader {
  queue = []; parser = new PacketParser(); fault = null;
  constructor(path, log = () => {}) {
    this.log = log;
    this.port = new SerialPort({ path, baudRate: 115200, autoOpen: false });
    this.port.on('error', error => { this.fault = error; });
    this.port.on('data', data => {
      const frames = this.parser.push(data);
      this.queue.push(...frames);
      if (this.queue.length > 200) this.fault = new Error('Demasiadas respuestas inesperadas.');
    });
  }
  async open() { await call(cb => this.port.open(cb)); }
  async close() { if (this.port.isOpen) await call(cb => this.port.close(cb)); }
  async write(bytes) { await call(cb => this.port.write(bytes, cb)); await call(cb => this.port.drain(cb)); }
  async wait(command, timeout = 4000, type) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (this.fault) throw this.fault;
      const index = this.queue.findIndex(frame => frame.command === command && (type === undefined || frame.type === type));
      if (index >= 0) return this.queue.splice(index, 1)[0];
      await delay(4);
    }
    throw new Error(`La placa no responde al paso ${command.toString(16)}.`);
  }
  async command(command, data = Buffer.alloc(0), number = 0, timeout = 4000) {
    await this.write(packet(0xa0, command, data, number));
    return this.wait(command, timeout, 0xa2);
  }
  async reset() {
    this.queue = []; this.parser = new PacketParser();
    await call(cb => this.port.set({ rts: true, dtr: false }, cb));
    await this.write(Buffer.alloc(16, 0x7f)); await delay(250);
    await call(cb => this.port.set({ rts: false, dtr: true }, cb));
    await this.write(Buffer.alloc(10, 0x55));
    for (let i = 0; i < 40; i++) {
      await this.write(packet(0xa1, 0x83));
      try {
        const response = await this.wait(0x83, 80);
        if (response.type === 0xa1) await this.write(packet(0xa2, 0x83));
        const identity = await this.command(0x85, Buffer.alloc(0), 1);
        if (identity.data.length !== 4 || identity.data.readUInt32LE(0) !== 0x4e) throw new Error('Identificador de placa no compatible.');
        this.log('Cargador ASRPRO confirmado (0x4e).'); return;
      } catch (error) { if (!error.message.startsWith('La placa no responde')) throw error; }
    }
    throw new Error('No se pudo entrar en el cargador USB.');
  }
  async baud(baudRate, ready) {
    const data = Buffer.alloc(4); data.writeUInt32LE(baudRate);
    await this.command(0x0b, data, 1);
    await call(cb => this.port.update({ baudRate }, cb)); await delay(60);
    await this.command(ready, Buffer.alloc(0), 1);
  }
  async ramAgent() {
    const agent = officialAgent(await readFile('vendor/asrpro/makebin.exe'));
    const padded = Buffer.alloc(Math.ceil(agent.length / 4096) * 4096, 0xff); agent.copy(padded);
    await this.baud(750000, 0x85);
    const metadata = Buffer.alloc(10);
    metadata.writeUInt32LE(0x1ff58000); metadata.writeUInt32LE(padded.length, 4); metadata.writeUInt16LE(crc16(padded), 8);
    await this.command(0x06, metadata);
    const until = Date.now() + 20000; const offsets = new Set(); let complete = false;
    while (Date.now() < until) {
      const frame = await this.waitNext(5000);
      if (frame.command === 0x09) {
        await this.write(packet(0xa2, 0x09, Buffer.alloc(0), frame.number));
        if (offsets.size !== padded.length / 1024) throw new Error('Transferencia RAM incompleta.');
        complete = true; break;
      }
      if (frame.type !== 0xa1 || frame.command !== 0x08 || frame.data.length !== 8) throw new Error('Peticion RAM inesperada.');
      const offset = frame.data.readUInt32LE(0); const requested = frame.data.readUInt32LE(4);
      if (requested === 0 || requested > 4096) throw new Error('Longitud RAM inesperada.');
      const size = Math.min(requested, 1024);
      if (size !== 1024 || offset % 1024 !== 0 || offset + size > padded.length) throw new Error(`Peticion RAM fuera de limites: offset=${offset}, bytes=${size}, total=${padded.length}.`);
      const payload = Buffer.alloc(4 + size); payload.writeUInt32LE(offset); padded.copy(payload, 4, offset, offset + size);
      await this.write(packet(0xa2, 0x08, payload, frame.number)); offsets.add(offset);
    }
    if (!complete) throw new Error('Transferencia RAM sin confirmacion final.');
    const verification = await this.command(0x8a);
    if (verification.data[0] !== 1) throw new Error('Verificacion RAM rechazada.');
    this.log('Agente oficial transferido y verificado en RAM. Sin escritura de flash.');
    await call(cb => this.port.update({ baudRate: 115200 }, cb)); await delay(100);
    await this.command(0x05, Buffer.alloc(0), 1);
    this.log('Agente de programacion operativo.');
  }
  async waitNext(timeout) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (this.fault) throw this.fault;
      if (this.queue.length) return this.queue.shift();
      await delay(4);
    }
    throw new Error('Tiempo agotado durante transferencia.');
  }
  async readFlash(address, size = 1024) {
    if (!Number.isInteger(address) || address < 0 || address + size > 2097152 || size < 1 || size > 1024) throw new Error('Lectura fuera de limites.');
    const data = Buffer.alloc(8); data.writeUInt32LE(address); data.writeUInt32LE(size, 4);
    const frame = await this.command(0x0d, data);
    if (frame.data.length !== size + 4 || frame.data.readUInt32LE(0) !== address) throw new Error('Respuesta de lectura no valida.');
    return frame.data.subarray(4);
  }
  async backup() {
    const content = Buffer.alloc(2097152);
    for (let address = 0; address < content.length; address += 1024) {
      (await this.readFlash(address)).copy(content, address);
      if (address % 262144 === 0) this.log(`Copia de seguridad: ${Math.round(address / content.length * 100)}%.`);
    }
    await mkdir('output/backups', { recursive: true });
    const file = `output/backups/placa-${Date.now()}.bin`;
    await writeFile(file, content, { flag: 'wx' });
    await writeFile(file + '.json', JSON.stringify({ bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') }));
    return file;
  }
  async flash(image) {
    if (image.length < 8192 || image.length > 2097152 || image.readUInt32LE(0) !== 0x25c0006f) throw new Error('Imagen ASRPRO no valida.');
    validateUserCode(image.subarray(0x4000));
    const info = await this.command(0x04);
    if (info.data.length < 8 || info.data[6] !== 0x15) throw new Error('No se ha confirmado una memoria de 2 MB.');
    await this.baud(1500000, 0x05);
    const backup = await this.backup(); this.log(`Respaldo guardado: ${backup}.`);
    // La recarga limpia las plantillas para que no queden frases de otro proyecto.
    const padded = Buffer.alloc(2097152, 0xff); image.copy(padded);
    const metadata = Buffer.alloc(10); metadata.writeUInt32LE(padded.length, 4); metadata.writeUInt16LE(crc16(padded), 8);
    await this.command(0x06, metadata);
    const erase = Buffer.alloc(12); erase.writeUInt32LE(padded.length, 4); erase.writeUInt32LE(4096, 8);
    this.log('Preparando memoria para el firmware nuevo.'); await this.command(0x07, erase, 0, 15000);
    const offsets = new Set(); const deadline = Date.now() + 120000; let complete = false; let lastPercent = -1;
    while (Date.now() < deadline) {
      const frame = await this.waitNext(15000);
      if (frame.type === 0xa1 && frame.command === 0x03) { await this.write(packet(0xa2, 0x03, Buffer.alloc(0), frame.number)); continue; }
      if (frame.command === 0x09 && frame.type === 0xa1) {
        if (offsets.size !== padded.length / 1024) throw new Error('Carga incompleta. No se reiniciara la placa.');
        await this.write(packet(0xa2, 0x09, Buffer.alloc(0), frame.number)); complete = true; break;
      }
      if (frame.type === 0xa3 && frame.command === 0x11) continue;
      if (frame.type !== 0xa1 || frame.command !== 0x08 || frame.data.length !== 8) throw new Error(`Peticion de carga inesperada: tipo ${frame.type.toString(16)}, comando ${frame.command.toString(16)}, datos ${frame.data.toString('hex')}.`);
      const offset = frame.data.readUInt32LE(0); const requested = frame.data.readUInt32LE(4);
      if (requested < 1024 || requested > 4096 || offset % 1024 || offset + 1024 > padded.length) throw new Error('Peticion de escritura fuera de limites.');
      const payload = Buffer.alloc(1028); payload.writeUInt32LE(offset); padded.copy(payload, 4, offset, offset + 1024);
      await this.write(packet(0xa2, 0x08, payload, frame.number)); offsets.add(offset);
      const percent = Math.floor(offsets.size * 1024 / padded.length * 100);
      if (percent >= lastPercent + 10) { this.log(`Cargando firmware: ${percent}%.`); lastPercent = percent; }
    }
    if (!complete) throw new Error('Tiempo agotado. La placa no confirmo toda la carga.');
    const verification = await this.command(0x0a, metadata, 0, 10000);
    if (verification.data[0] !== 1) throw new Error('La placa rechazo la verificacion del firmware.');
    this.log('CRC confirmado por la placa. Comprobando lectura completa...');
    for (let address = 0; address < padded.length; address += 1024) {
      if (!(await this.readFlash(address)).equals(padded.subarray(address, address + 1024))) throw new Error(`La lectura de comprobacion difiere en ${address}.`);
    }
    this.log('Firmware leido y comparado byte a byte.');
    await call(cb => this.port.set({ rts: false, dtr: false }, cb));
    await this.command(0xa1); await call(cb => this.port.update({ baudRate: 115200 }, cb));
    return { backup, bytes: image.length };
  }
  async confirmFirmware(hash) {
    const nonce = randomBytes(8).toString('hex'); const expected = `STUDIO:1:${hash}:${nonce}`;
    let buffer = ''; let confirmed = false; const logged = new Set();
    const onData = bytes => {
      buffer = (buffer + bytes.toString('utf8')).slice(-8192);
      const lines = buffer.split(/\r?\n/); buffer = lines.pop();
      for (const line of lines) {
        if (line === expected) confirmed = true;
        if (line.trim() && line !== expected && !logged.has(line) && logged.size < 80) { logged.add(line); this.log(line.slice(0, 240)); }
      }
    };
    this.port.on('data', onData);
    try {
      for (let i = 0; i < 30 && !confirmed; i++) { await this.write(Buffer.from(`HELLO:${nonce}\n`)); await delay(400); }
      if (!confirmed) throw new Error('Firmware escrito y verificado, pero aun no ha confirmado su inicio.');
      this.log('El firmware ASRPRO Studio esta ejecutandose en la placa.');
    } finally { this.port.off('data', onData); }
  }
}

export async function flashBoard(path, image, hash, log) {
  let loader; const deadline = Date.now() + 45000; let ready = false;
  while (!ready && Date.now() < deadline) {
    loader = new BoardLoader(path, log);
    try { await loader.open(); await loader.reset(); ready = true; }
    catch { await loader.close().catch(() => {}); await delay(500); }
  }
  if (!ready) throw new Error('No se pudo entrar en el cargador USB. Desconecta y reconecta la placa durante la espera.');
  try { await loader.ramAgent(); const result = await loader.flash(image); await loader.confirmFirmware(hash); return result; }
  finally { await loader.close(); }
}
