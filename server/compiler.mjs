import { spawn } from 'node:child_process';
import { access, copyFile, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { generateHeader, projectHash } from './project.mjs';
import { validateUserCode, assembleFirmware } from './firmware-layout.mjs';

export const sdk = path.resolve('vendor/asrpro');
const projectDir = path.join(sdk, 'asr_pro_sdk/projects/cwsl_sample');
const toolkit = path.join(sdk, 'asr_pro_sdk/tools/ci-tool-kit.exe');
export async function sdkReady() { try { await access(toolkit); await access(path.join(sdk, 'gcc/bin/riscv-nuclei-elf-gcc.exe')); return true; } catch { return false; } }
export function run(executable, args, cwd, onLine = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, env: { ...process.env, PATH: [path.join(sdk, 'gcc/bin'), path.join(sdk, 'asr_pro_sdk/tools/build-tools/bin'), process.env.PATH].join(path.delimiter) }, shell: false });
    let output = ''; let partial = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('La herramienta superó el tiempo máximo de 4 minutos.')); }, 240000);
    const consume = chunk => { output = (output + chunk.toString()).slice(-200000); partial += chunk.toString(); const lines = partial.split(/\r?\n/); partial = lines.pop(); for (const line of lines) if (line.trim()) onLine(line); };
    child.stdout.on('data', consume); child.stderr.on('data', consume);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); if (partial.trim()) onLine(partial); code === 0 ? resolve(output) : reject(new Error(`La herramienta terminó con código ${code}. ${output.slice(-1800)}`)); });
  });
}
export async function compile(project, event) {
  if (!await sdkReady()) throw new Error('Falta el SDK oficial ASRPRO en vendor/asrpro.');
  await mkdir('output', { recursive: true });
  await copyFile('firmware/studio.cpp', path.join(sdk, 'asr.cpp'));
  await copyFile('firmware/studio.c', path.join(projectDir, 'src/cwsl_app_sample1.c'));
  await writeFile(path.join(projectDir, 'src/studio-project.h'), generateHeader(project));
  const makefilePath = path.join(projectDir, 'project_file/makefile');
  const makefile = await readFile(makefilePath, 'utf8');
  await writeFile(makefilePath, makefile.replace('riscv-none-embed-ar', 'riscv-nuclei-elf-ar'));
  event('info', 'Compilando firmware con el SDK oficial...');
  let buildLog = '';
  await run(path.join(sdk, 'asr_pro_sdk/tools/build-tools/bin/make.exe'), ['-B', '-j2'], path.join(projectDir, 'project_file'), line => { buildLog += line + '\n'; if (/error:|undefined reference/i.test(line)) event('error', line); });
  await writeFile('output/compilation.log', buildLog);
  // La tabla de comandos del fabricante se transforma con un lector estructurado.
  const workbook = new ExcelJS.Workbook();
  const infoDir = path.join(sdk, 'user_file/cmd_info');
  const input = path.join(infoDir, '[60000]{cmd_info}.xlsx');
  await workbook.xlsx.readFile(input);
  const sheet = workbook.worksheets[0];
  event('info', 'Preparando tabla de comandos aprendibles...');
  if (sheet.getCell('D1').value !== '命令词ID') throw new Error('La tabla oficial no tiene el esquema esperado.');
  for (let row = sheet.rowCount; row > 1; row--) {
    const id = Number(sheet.getCell(row, 4).value);
    if (id >= 10300 && id <= 10311) sheet.spliceRows(row, 1);
  }
  const template = sheet.getRow(3).values.slice(1);
  for (const item of [{ id: 0, phrase: 'Palabra de activacion' }, ...project.commands]) {
    const row = [...template]; row[0] = null; row[1] = null; row[2] = item.phrase;
    row[3] = item.id === 0 ? 10300 : 10301 + item.id; row[4] = '0x00'; row[6] = item.id === 0 ? 'YES' : 'NO'; row[12] = null;
    sheet.addRow(row);
  }
  await workbook.xlsx.writeFile(input);
  let packLog = '';
  const tool = args => run(toolkit, args, sdk, line => { packLog += line + '\n'; });
  await copyFile(path.join(sdk, 'asr_pro_sdk/libs/libfbin.a'), path.join(sdk, 'user_code/[1]code.bin'));
  await tool(['merge', 'user-file', '-i', path.join(sdk, 'user_code')]);
  validateUserCode(await readFile(path.join(sdk, 'user_code/user_code.bin')));
  await tool(['cmd-info', '-V2', '-i', input]);
  await copyFile(input + '.bin', path.join(sdk, 'user_file/[60000]{cmd_info}.xlsx.bin'));
  await tool(['merge', 'user-file', '-i', path.join(sdk, 'user_file')]);
  await tool(['merge', 'asr-file', '-i', path.join(sdk, 'asr')]);
  await tool(['merge', 'nn-file', '-i', path.join(sdk, 'dnn'), '-a', path.join(sdk, 'asr')]);
  await tool(['make-firmware', '-f', 'v2', '--chip-name', 'CI130*', '--firmware-name', 'VozEstudio', '--rom-size', '2097152', '--user-code', path.join(sdk, 'user_code/user_code.bin'), '--asr-file', path.join(sdk, 'asr/asr.bin'), '--nn-file', path.join(sdk, 'dnn/dnn.bin'), '--voice-file', path.join(sdk, 'voice/voice.bin'), '--user-file', path.join(sdk, 'user_file/user_file.bin'), '--boot-file', path.join(sdk, 'data/boot.bin'), '--output-path', path.resolve('output')]);
  const sections = new Map();
  for (const [index, file] of [[0, 'user_code/user_code.bin'], [2, 'asr/asr.bin'], [3, 'dnn/dnn.bin'], [4, 'voice/voice.bin'], [5, 'user_file/user_file.bin']]) {
    sections.set(index, await readFile(path.join(sdk, file)));
  }
  await writeFile('output/fw.bin', assembleFirmware(await readFile('output/VozEstudio_2.0.0.bin'), sections));
  await writeFile('output/packaging.log', packLog);
  await copyFile(path.join(sdk, 'user_code/user_code.bin'), 'output/user-code.bin');
  const bytes = (await stat('output/fw.bin')).size;
  if (bytes < 1024 || bytes > 2097152) throw new Error('El tamaño del firmware no es válido para una memoria de 2 MB.');
  await writeFile('output/build.json', JSON.stringify({ hash: projectHash(project), bytes, packaged: true, date: new Date().toISOString() }, null, 2));
  event('success', `Firmware compilado: ${Math.ceil(bytes / 1024)} KB. La carga requiere verificar el programador.`);
  return { bytes, hash: projectHash(project), packaged: true };
}
