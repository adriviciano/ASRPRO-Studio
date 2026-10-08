import { Injectable, signal } from '@angular/core';
import { translations } from '../utils/translations';
import { detectLanguage } from '../utils/detect-language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly language = signal<'es' | 'en'>(detectLanguage(navigator.language));

  constructor() { document.documentElement.lang = this.language(); }

  setLanguage(value: string): void {
    if (value !== 'es' && value !== 'en') return;
    this.language.set(value);
    document.documentElement.lang = value;
  }

  translate(value: string): string {
    if (this.language() === 'es') return value;
    if (translations[value]) return translations[value];
    const prefix = Object.keys(translations).sort((a, b) => b.length - a.length).find(key => value.startsWith(key + ' '));
    if (prefix) return translations[prefix] + value.slice(prefix.length).replace('(Codigo ', '(Code ').replace('La carga requiere verificar el programador.', 'Uploading requires programmer verification.');
    const port = /^Puerto (.+) abierto\. Esperando confirmación del firmware compatible\.$/.exec(value);
    if (port) return `Port ${port[1]} open. Waiting for compatible firmware confirmation.`;
    if (value.endsWith(' KB · Firmware disponible')) return value.replace('Firmware disponible', 'Firmware available');
    return value;
  }
}
