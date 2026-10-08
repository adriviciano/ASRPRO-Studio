export function validateUserCode(buffer) {
  if (buffer.length < 32 || buffer.readUInt16LE(0) !== 2) throw new Error('El firmware debe incluir los dos nucleos ASRPRO.');
  let previousEnd = 32;
  for (let id = 0; id < 2; id++) {
    const entry = 2 + id * 10;
    const start = buffer.readUInt32LE(entry + 2); const size = buffer.readUInt32LE(entry + 6);
    if (buffer.readUInt16LE(entry) !== id || start < previousEnd || size < 4 || start + size > buffer.length) throw new Error('Tabla de programas ASRPRO no valida.');
    previousEnd = start + size;
  }
}
export function assembleFirmware(template, sections) {
  if (template.length < 0x4000) throw new Error('Cabecera de firmware incompleta.');
  let end = 0x4000;
  const placements = [];
  for (const index of [0, 2, 3, 4, 5]) {
    const entry = 0x2000 + 166 + index * 17;
    const address = template.readUInt32LE(entry + 4);
    const size = template.readUInt32LE(entry + 8);
    const data = sections.get(index);
    if (!data || data.length !== size || address < end || address % 4096 || address + size > 0x1f8000) {
      throw new Error('Distribucion de firmware no valida: particion ' + index);
    }
    placements.push({ address, data }); end = address + size;
  }
  // El empaquetador omite un byte de relleno entre secciones; se respetan las direcciones de su tabla.
  const image = Buffer.alloc(end, 0xff);
  template.copy(image, 0, 0, 0x4000);
  for (const { address, data } of placements) data.copy(image, address);
  return image;
}
