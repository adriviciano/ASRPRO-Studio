import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTypeScript(path) {
  const source = await readFile(path, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputText).toString('base64'));
}

test('Idioma: espanol solo para el idioma principal es; ingles para los demas', async () => {
  const { detectLanguage } = await importTypeScript('src/app/utils/detect-language.ts');
  for (const locale of ['es', 'es-ES', 'es-MX', 'ES-ar']) assert.equal(detectLanguage(locale), 'es');
  for (const locale of ['en', 'en-US', 'fr-FR', 'de', '', 'est']) assert.equal(detectLanguage(locale), 'en');
});

test('Los textos estaticos de ambos modos tienen traduccion inglesa', async () => {
  const { translations } = await importTypeScript('src/app/utils/translations.ts');
  for (const path of ['src/app/app.component.html', 'src/app/pages/guided/guided.component.html']) {
    const template = await readFile(path, 'utf8');
    for (const match of template.matchAll(/'([^']+)'\s*\| translate/g)) {
      if (/^(ASRPRO|USB|Firmware|COM4|2 MB)/.test(match[1])) continue;
      assert.ok(translations[match[1]], 'Falta traduccion: ' + match[1]);
    }
  }
});
