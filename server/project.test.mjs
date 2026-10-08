import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, generateHeader, projectHash } from './project.mjs';
// Las pruebas no dependen del proyecto editable del usuario.
const project = validateProject({ commands: ['FAN_MAX', 'FAN_MIN', 'FAN_OFF', 'LIGHT_ON', 'LIGHT_OFF', 'SPEED_UP', 'SPEED_DOWN'].map((message, index) => ({
  id: index + 1, phrase: 'Frase ' + (index + 1), message, action: ''
})) });
test('Proyecto contiene los siete comandos solicitados', () => {
  assert.equal(project.commands.length, 7);
  assert.deepEqual(project.commands.map(c => c.message), ['FAN_MAX', 'FAN_MIN', 'FAN_OFF', 'LIGHT_ON', 'LIGHT_OFF', 'SPEED_UP', 'SPEED_DOWN']);
});
test('Rechaza IDs, mensajes y frases duplicados', () => {
  for (const property of ['id', 'message', 'phrase']) {
    const copy = structuredClone(project); copy.commands[1][property] = copy.commands[0][property];
    assert.throws(() => validateProject(copy));
  }
});
test('Rechaza inyeccion en mensaje C y limites invalidos', () => {
  const copy = structuredClone(project); copy.commands[0].message = 'X";';
  assert.throws(() => validateProject(copy));
  assert.throws(() => validateProject({ commands: [] }));
  copy.commands[0].message = 'OK'; copy.commands[0].id = 11;
  assert.throws(() => validateProject(copy));
});
test('Hash y tabla corresponden a cada comando', () => {
  const header = generateHeader(project);
  assert.ok(header.includes(projectHash(project)));
  for (const command of project.commands) assert.ok(header.includes(`case ${10301 + command.id}: return "${command.message}";`));
  const copy = structuredClone(project); copy.commands[0].phrase += ' ahora';
  assert.notEqual(projectHash(copy), projectHash(project));
});
