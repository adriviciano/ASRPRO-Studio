import express from 'express';
import { learningFailure } from './learning-feedback.mjs';
import { createServer as createViteServer } from 'vite';
import { SerialPort } from 'serialport';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { validateProject, projectHash } from './project.mjs';
import { compile, sdkReady } from './compiler.mjs';
import { flashBoard } from './board-loader.mjs';

const app = express();
const portNumber = Number(process.env.PORT || 5187);
let project;
try {
  project = validateProject(JSON.parse(await readFile('voice-commands.json', 'utf8')));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  project = validateProject(JSON.parse(await readFile('voice-commands.example.json', 'utf8')));
}
let serial = null; let buffer = ''; let nonce = ''; let boardHash = null;
const state = { connected: false, port: null, verified: false, busy: false, sdkReady: await sdkReady(), firmwareReady: false, firmwareBytes: 0, buildHash: null, flashed: false, learned: [], learningSlot: null, learningState: 'idle', events: [] };
Object.assign(state, { learningTake: 1, lastLearningSlot: null, learningError: '' });
let eventId = 0;
try {
  const build = JSON.parse(await readFile('output/build.json', 'utf8'));
  if (build.packaged && build.hash === projectHash(project) && (await readFile('output/fw.bin')).length === build.bytes) {
    state.firmwareReady = true; state.firmwareBytes = build.bytes; state.buildHash = build.hash;
  }
} catch { /* Puede no existir una compilacion anterior. */ }
function event(level, text, raw) { state.events.push({ id: ++eventId, time: new Date().toLocaleTimeString('es-ES'), level, text, ...(raw ? { raw } : {}) }); state.events = state.events.slice(-300); }
function fail(message) { throw new Error(message); }
function available() { if (state.busy) fail('Hay una operación en curso.'); }
function requireBoard() { available(); if (!state.connected || !state.verified || boardHash !== projectHash(project)) fail('La placa no ha confirmado el firmware de este proyecto.'); }
function resetConnection() { state.connected = false; state.verified = false; state.port = null; boardHash = null; state.learned = []; state.learningSlot = null; state.learningState = 'idle'; buffer = ''; }
function receive(line) {
  if (line === `STUDIO:1:${projectHash(project)}:${nonce}`) { state.verified = true; state.flashed = true; boardHash = projectHash(project); event('success', 'Firmware del proyecto confirmado por la placa.'); return; }
  if (!state.verified) { event('info', 'USB: ' + line.slice(0, 200), line); return; }
  const [name, value] = line.split(':'); const id = Number(value);
  if (name === 'TEMPLATES' && /^(\d+(,\d+)*)?$/.test(value)) { state.learned = value ? [...new Set(value.split(',').map(Number).filter(n => n >= 0 && n <= 10))] : []; }
  else if (['READY', 'LISTEN', 'REPEAT'].includes(name) && Number.isInteger(id) && id === state.learningSlot) { state.learningState = { READY: 'ready', LISTEN: 'listening', REPEAT: 'repeat' }[name]; if (name === 'REPEAT') state.learningTake = 2; if (name === 'LISTEN') state.learningError = ''; event('info', { READY: 'Listo para grabar.', LISTEN: 'Escuchando: habla ante el micrófono de la placa.', REPEAT: 'Primera toma recibida. Repite la misma frase.' }[name]); }
  else if (name === 'LEARNED' && id === state.learningSlot) { if (!state.learned.includes(id)) state.learned.push(id); state.learningSlot = null; state.learningState = 'learned'; state.learningError = ''; event('success', 'La placa ha confirmado el aprendizaje de la frase.'); }
  else if (name === 'STOPPED') { state.learningSlot = null; state.learningState = 'idle'; event('info', 'Aprendizaje terminado.'); }
  else if (name === 'RETRY') { const failure = learningFailure(id, state.learningTake); state.learningError = failure.message; state.learningTake = failure.take; event('error', state.learningError, line); }
  else if (name === 'ERROR') { state.learningSlot = null; state.learningState = 'idle'; event('error', 'La placa rechazó la operación.'); }
  else if (name === 'CMD') { const command = project.commands.find(c => c.id === id); if (command) event('success', `Reconocido: ${command.phrase} → ${command.message}`, line); }
  else event('info', line.slice(0, 200), line);
}
async function send(line) { if (!serial?.isOpen) fail('El puerto USB no está abierto.'); await new Promise((resolve, reject) => serial.write(line + '\n', error => error ? reject(error) : serial.drain(error2 => error2 ? reject(error2) : resolve()))); }
async function disconnect() {
  const current = serial; serial = null;
  if (current?.isOpen) await new Promise(resolve => current.close(() => resolve()));
  resetConnection();
}
app.use((req, res, next) => {
  const host = req.headers.host;
  if (host !== `127.0.0.1:${portNumber}` && host !== `localhost:${portNumber}`) return res.status(403).json({ error: 'Sólo se permiten conexiones locales.' });
  if (req.method !== 'GET' && req.headers.origin && ![`http://127.0.0.1:${portNumber}`, `http://localhost:${portNumber}`].includes(req.headers.origin)) return res.status(403).json({ error: 'Origen no permitido.' });
  next();
});
app.use(express.json({ limit: '32kb' }));
const route = (url, fn) => app.post('/api/' + url, async (req, res) => { try { const result = await fn(req.body); res.json(result ?? { ok: true }); } catch (error) { event('error', error.message); res.status(400).json({ error: error.message }); } });
app.get('/api/project', (_req, res) => res.json(project));
app.get('/api/status', (_req, res) => res.json(state));
app.get('/api/ports', async (_req, res) => { try { res.json(await SerialPort.list()); } catch { res.status(503).json({ error: 'No se pudieron consultar los puertos USB.' }); } });
route('project', async value => {
  available(); if (state.learningSlot !== null) fail('Termina el aprendizaje antes de cambiar el proyecto.');
  const next = validateProject(value); const changed = projectHash(next) !== projectHash(project);
  await writeFile('voice-commands.json.tmp', JSON.stringify(next, null, 2)); await rename('voice-commands.json.tmp', 'voice-commands.json'); project = next;
  if (changed) { state.firmwareReady = false; state.verified = false; state.learned = []; }
  event('success', 'Proyecto guardado.');
});
async function connect(body) {
  if (!body || typeof body.port !== 'string') fail('Selecciona un puerto USB.');
  const ports = await SerialPort.list(); if (!ports.some(p => p.path === body.port)) fail('El puerto seleccionado no está conectado.');
  await disconnect();
  const current = new SerialPort({ path: body.port, baudRate: 115200, autoOpen: false }); serial = current;
  current.on('error', error => event('error', 'USB: ' + error.message));
  current.on('close', () => { if (serial === current) { serial = null; resetConnection(); event('info', 'La placa se ha desconectado.'); } });
  current.on('data', chunk => { buffer = (buffer + chunk.toString('utf8')).slice(-4096); const lines = buffer.split(/\r?\n/); buffer = lines.pop(); for (const line of lines) if (line.trim()) receive(line.trim()); });
  await new Promise((resolve, reject) => current.open(error => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => current.set({ rts: false, dtr: false }, error => error ? reject(error) : resolve()));
  state.connected = true; state.port = body.port; nonce = randomBytes(8).toString('hex'); await send('HELLO:' + nonce);
  const started = Date.now();
  const greeting = setInterval(() => {
    if (serial !== current || state.verified || Date.now() - started > 15000) { clearInterval(greeting); return; }
    void send('HELLO:' + nonce).catch(() => clearInterval(greeting));
  }, 400);
  event('info', `Puerto ${body.port} abierto. Esperando confirmación del firmware compatible.`);
}
route('connect', async body => { available(); state.busy = true; try { await connect(body); } finally { state.busy = false; } });
route('disconnect', async () => { available(); if (state.learningSlot !== null && serial?.isOpen) await send('STOP'); await disconnect(); });
route('compile', async () => {
  available(); if (state.learningSlot !== null) fail('Termina el aprendizaje antes de compilar.');
  state.busy = true; state.firmwareReady = false;
  try { const result = await compile(project, event); state.firmwareBytes = result.bytes; state.buildHash = result.hash; state.firmwareReady = result.packaged; } finally { state.busy = false; }
});
route('flash', async body => {
  available(); if (state.learningSlot !== null) fail('Termina el aprendizaje antes de cargar.');
  if (!state.firmwareReady || state.buildHash !== projectHash(project)) fail('Compila el proyecto guardado antes de cargar.');
  const path = body?.port;
  const ports = await SerialPort.list();
  if (!ports.some(p => p.path === path && p.vendorId?.toLowerCase() === '1a86' && p.productId?.toLowerCase() === '7522')) fail('Selecciona la placa USB CH340 conectada.');
  state.busy = true; state.flashed = false;
  try {
    await disconnect();
    const result = await flashBoard(path, await readFile('output/fw.bin'), state.buildHash, text => event('info', text));
    state.flashed = true;
    await writeFile('output/flash.json', JSON.stringify({ ...result, hash: state.buildHash, verified: true, date: new Date().toISOString() }));
    await connect({ port: path });
    event('success', 'Firmware cargado, comprobado y arrancado en la placa.');
  } finally { state.busy = false; }
});
route('learn', async body => { requireBoard(); if (state.learningSlot !== null) fail('Termina la frase actual antes de seleccionar otra.'); const id = body?.id; if (id !== 0 && !project.commands.some(c => c.id === id)) fail('Comando desconocido.'); state.learningSlot = id; state.lastLearningSlot = id; state.learningTake = 1; state.learningError = ''; state.learningState = 'starting'; try { await send('LEARN:' + id); } catch (error) { state.learningSlot = null; state.learningState = 'idle'; throw error; } });
route('record', async () => {
  requireBoard(); if (!['ready', 'repeat'].includes(state.learningState)) fail('La placa no está lista para grabar.');
  const previous = state.learningState; state.learningState = 'recording-start'; state.learningError = '';
  try { await send('RECORD'); } catch (error) { state.learningState = previous; throw error; }
});
route('learn/stop', async () => { requireBoard(); await send('STOP'); });
route('events/clear', () => { state.events = []; });
app.get('/api/firmware/download', (_req, res) => { if (!state.firmwareReady) return res.status(409).json({ error: 'Todavía no hay un firmware completo validado.' }); res.download('output/fw.bin', 'asrpro-firmware.bin'); });
app.use('/api', (_req, res) => res.status(404).json({ error: 'Operación desconocida.' }));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (_req, res) => res.sendFile('index.html', { root: 'dist' }));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.listen(portNumber, '127.0.0.1', () => console.log(`ASRPRO Studio: http://127.0.0.1:${portNumber}`));
event('info', 'Entorno iniciado. Los comandos no se marcarán aprendidos sin confirmación física.');
