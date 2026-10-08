import { createHash } from 'node:crypto';

export function validateProject(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.commands) || value.commands.length < 1 || value.commands.length > 10) throw new Error('El proyecto debe tener entre 1 y 10 comandos.');
  const ids = new Set(); const messages = new Set(); const phrases = new Set();
  const commands = value.commands.map(command => {
    if (!command || !Number.isInteger(command.id) || command.id < 1 || command.id > 10 || ids.has(command.id)) throw new Error('Los identificadores deben ser únicos, del 1 al 10.');
    if (typeof command.phrase !== 'string' || !command.phrase.trim() || command.phrase.length > 80) throw new Error('Cada frase debe contener entre 1 y 80 caracteres.');
    if (typeof command.message !== 'string' || !/^[A-Z][A-Z0-9_]{0,31}$/.test(command.message) || messages.has(command.message)) throw new Error('Los mensajes deben ser únicos: mayúsculas, números y guiones bajos.');
    if (typeof command.action !== 'string' || command.action.length > 160) throw new Error('La acción no puede superar 160 caracteres.');
    const phrase = command.phrase.trim(); const key = phrase.toLocaleLowerCase('es');
    if (phrases.has(key)) throw new Error('Las frases de voz no pueden repetirse.');
    ids.add(command.id); messages.add(command.message); phrases.add(key);
    return { id: command.id, phrase, message: command.message, action: command.action.trim() };
  });
  return { status: 'defined-not-flashed', language: 'es', transport: 'uart', lineEnding: '\n', commands };
}
export function projectHash(project) { return createHash('sha256').update(JSON.stringify(project.commands)).digest('hex').slice(0, 16); }
export function generateHeader(project) {
  return `#define STUDIO_HASH "${projectHash(project)}"\nstatic const char *studio_message(uint32_t id) {\n switch (id) {\n${project.commands.map(c => `case ${10301 + c.id}: return "${c.message}";`).join('\n')}\n default: return NULL; }\n}\nstatic bool studio_has_slot(int slot) { return studio_message(10301 + slot) != NULL; }\n`;
}
