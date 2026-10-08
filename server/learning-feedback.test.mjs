import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { learningFailure } from './learning-feedback.mjs';

test('Un rechazo de comparacion reinicia las tomas y conserva su codigo', () => {
  assert.equal(learningFailure(1, 2).take, 1);
  assert.match(learningFailure(1, 2).message, /Codigo 1/);
});

test('Una toma corta o invalida no pierde la primera toma aceptada', () => {
  assert.equal(learningFailure(4, 2).take, 2);
  assert.equal(learningFailure(5, 2).take, 2);
  assert.match(learningFailure(4, 2).message, /demasiado corta/);
});

test('El reintento completa el reinicio del SDK, no solo marca su bandera', async () => {
  const source = await readFile('firmware/studio.c', 'utf8');
  // Contrato de integracion; el resultado acustico requiere la placa y voz real.
  assert.match(source, /cwsl_set_reg_restart_flag\(\);\s*cwsl_reg_restart\(\);/);
});

test('El aprendizaje entrega los resultados ASR y fin de audio al SDK', async () => {
  const source = await readFile('firmware/studio.c', 'utf8');
  const handler = source.slice(source.indexOf('uint32_t cwsl_app_process_asr_msg'));
  assert.match(handler, /cwsl_reg_check_other_asrcmd\(id,\s*1\)/);
  assert.match(handler, /send_nn_end_msg_to_cwsl\(NULL,\s*0\)/);
});

test('Finalizar una toma no borra la plantilla temporal necesaria para la segunda', async () => {
  const source = await readFile('firmware/studio.c', 'utf8');
  const handler = source.slice(source.indexOf('int on_cwsl_record_end'), source.indexOf('int on_cwsl_delete_successed'));
  assert.doesNotMatch(handler, /cwsl_reg_record_stop\s*\(/);
});
