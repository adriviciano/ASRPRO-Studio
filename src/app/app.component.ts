import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Mic, Cpu, Cable, RefreshCw, Save, Download, Upload, Plus, Trash2, ChevronRight, Check, Radio, Terminal, Fan, Lightbulb, ArrowUp, ArrowDown, CircleHelp, X, FolderOpen, Square, Play, Volume2 } from 'lucide-angular';
import { StudioService } from './services/studio.service';
import { LanguageService } from './services/language.service';
import { TranslatePipe } from './utils/translate.pipe';
import { VoiceCommand } from './models/studio';
import template from './app.component.html?raw';

@Component({
  selector: 'app-root', standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TranslatePipe],
  template
})
export class AppComponent {
  readonly language = inject(LanguageService);
  readonly studio = inject(StudioService);
  private readonly destroyRef = inject(DestroyRef);
  readonly icons = { Mic, Cpu, Cable, RefreshCw, Save, Download, Upload, Plus, Trash2, ChevronRight, Check, Radio, Terminal, Fan, Lightbulb, ArrowUp, ArrowDown, CircleHelp, X, FolderOpen, Square, Play, Volume2 };
  readonly tab = signal<'commands' | 'firmware' | 'learning' | 'monitor'>('commands');
  readonly selectedPort = signal('COM4');
  readonly editing = signal<VoiceCommand | null>(null);
  readonly dirty = signal(false);
  readonly help = signal(false);
  readonly draft = signal<VoiceCommand[]>([]);
  readonly eventFilter = signal('');
  readonly filteredEvents = computed(() => {
    const filter = this.eventFilter().toLowerCase();
    return (this.studio.status()?.events ?? []).filter(event => event.text.toLowerCase().includes(filter)).slice().reverse();
  });
  readonly canOperate = computed(() => !this.studio.working() && !this.studio.status()?.busy);
  readonly firmwareSize = computed(() => ((this.studio.status()?.firmwareBytes ?? 0) / 1024).toFixed(0));
  readonly learnedCount = computed(() => this.draft().filter(command => this.studio.status()?.learned.includes(command.id)).length);
  readonly learningPhrase = computed(() => {
    const status = this.studio.status();
    const slot = status?.learningSlot ?? (status?.learningState === 'learned' ? status.lastLearningSlot : null);
    return slot === 0 ? this.language.translate('Palabra de activación') : this.draft().find(command => command.id === slot)?.phrase ?? this.language.translate('Selecciona un comando');
  });
  readonly learningLabel = computed(() => {
    if (!this.studio.status()?.verified) return 'Placa pendiente de conexión';
    const labels: Record<string, string> = { idle: 'Selecciona una frase', starting: 'Preparando aprendizaje', 'recording-start': 'Iniciando micrófono', ready: 'Listo para grabar', listening: 'Escuchando', repeat: 'Repite la frase', learned: 'Frase aprendida' };
    return labels[this.studio.status()?.learningState ?? 'idle'] ?? 'Preparando';
  });
  readonly canSelectPhrase = computed(() => this.canOperate() && !!this.studio.status()?.verified && this.studio.status()?.learningSlot == null);
  readonly canRecord = computed(() => this.canOperate() && !!this.studio.status()?.verified && ['ready', 'repeat'].includes(this.studio.status()?.learningState ?? ''));
  readonly recordingLabel = computed(() => this.studio.status()?.learningTake === 2 ? 'Grabar segunda toma' : 'Grabar frase');

  constructor() {
    void this.initialize();
    const timer = setInterval(() => { void this.studio.poll(); }, 250);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private async initialize(): Promise<void> {
    await this.studio.refresh(); this.draft.set(this.studio.project()?.commands.map(command => ({ ...command })) ?? []);
  }
  async save(): Promise<void> {
    const project = this.studio.project(); if (!project) return;
    await this.studio.action('project', { ...project, commands: this.draft() });
    if (!this.studio.error()) this.dirty.set(false);
  }
  edit(command: VoiceCommand): void { this.editing.set({ ...command }); }
  updateEdit(key: 'phrase' | 'message' | 'action', value: string): void {
    this.editing.update(command => command ? { ...command, [key]: value } : null);
  }
  commitEdit(): void {
    const command = this.editing(); if (!command || !command.phrase.trim() || !/^[A-Z][A-Z0-9_]{0,31}$/.test(command.message)) return;
    const exists = this.draft().some(item => item.id === command.id);
    this.draft.update(items => exists ? items.map(item => item.id === command.id ? command : item) : [...items, command]);
    this.editing.set(null); this.dirty.set(true);
  }
  add(): void {
    const next = Array.from({ length: 10 }, (_, index) => index + 1).find(id => !this.draft().some(command => command.id === id));
    if (!next) return;
    this.editing.set({ id: next, phrase: '', message: 'COMANDO_' + next, action: '' });
  }
  remove(id: number): void { this.draft.update(items => items.filter(item => item.id !== id)); this.dirty.set(true); }
  async connect(): Promise<void> { await this.studio.action('connect', { port: this.selectedPort() }); }
  async compile(): Promise<void> { await this.save(); if (!this.studio.error()) await this.studio.action('compile'); }
  async flash(): Promise<void> {
    if (!window.confirm(this.language.translate('Cargar firmware y borrar las frases aprendidas de la placa? Se guardara una copia de seguridad.'))) return;
    await this.studio.action('flash', { port: this.selectedPort() });
  }
  async learn(id: number): Promise<void> { await this.studio.action('learn', { id }); }
  exportProject(): void {
    const project = { ...this.studio.project(), commands: this.draft() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'asrpro-proyecto.json'; link.click(); URL.revokeObjectURL(url);
  }
  async importProject(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      await this.studio.action('project', value);
      if (!this.studio.error()) { this.draft.set(this.studio.project()?.commands ?? []); this.dirty.set(false); }
    } catch { this.studio.error.set('El archivo no es un proyecto JSON valido.'); }
    input.value = '';
  }
  commandIcon(message: string) { return message.startsWith('LIGHT') ? this.icons.Lightbulb : message === 'SPEED_UP' ? this.icons.ArrowUp : message === 'SPEED_DOWN' ? this.icons.ArrowDown : this.icons.Fan; }
  isLearned(id: number): boolean { return this.studio.status()?.learned.includes(id) ?? false; }
  async clearEvents(): Promise<void> { await this.studio.action('events/clear'); }
}
