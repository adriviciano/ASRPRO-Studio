import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ArrowLeft, ArrowRight, Check, Mic, Plus, Trash2, Cpu, Upload, RefreshCw, Square } from 'lucide-angular';
import { StudioService } from '../../services/studio.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../utils/translate.pipe';
import { VoiceCommand } from '../../models/studio';
import template from './guided.component.html?raw';

@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule, LucideAngularModule, TranslatePipe], template })
export class GuidedComponent {
  readonly language = inject(LanguageService);
  readonly studio = inject(StudioService);
  private readonly destroyRef = inject(DestroyRef);
  readonly icons = { ArrowLeft, ArrowRight, Check, Mic, Plus, Trash2, Cpu, Upload, RefreshCw, Square };
  readonly stages = ['Comandos', 'Compilar', 'Cargar', 'Grabar'];
  readonly step = signal(0);
  readonly draft = signal<VoiceCommand[]>([]);
  readonly ready = signal(false);
  readonly compiled = signal(false);
  readonly loaded = signal(false);
  readonly port = signal('COM4');
  readonly eraseAccepted = signal(false);
  readonly selected = signal(0);
  readonly activation = signal('Hola asistente');
  readonly operating = computed(() => this.studio.working() || !!this.studio.status()?.busy);
  readonly connected = computed(() => !!this.studio.status()?.connected);
  readonly visibleStep = computed(() => {
    if (!this.connected()) return -1;
    if (this.step() === 3 && !this.boardMatches()) return 1;
    if (this.step() === 2 && !this.buildMatches() && !this.boardMatches()) return 1;
    return this.step();
  });
  readonly matchesProject = computed(() => JSON.stringify(this.draft()) === JSON.stringify(this.studio.project()?.commands));
  readonly boardMatches = computed(() => this.connected() && this.matchesProject() && !!this.studio.status()?.verified);
  readonly buildMatches = computed(() => this.matchesProject() && !!this.studio.status()?.firmwareReady);
  readonly valid = computed(() => {
    const commands = this.draft();
    return commands.length > 0 && commands.length <= 10
      && commands.every(c => c.phrase.trim().length > 0 && c.phrase.length <= 80 && /^[A-Z][A-Z0-9_]{0,31}$/.test(c.message))
      && new Set(commands.map(c => c.phrase.trim().toLocaleLowerCase('es'))).size === commands.length
      && new Set(commands.map(c => c.message)).size === commands.length;
  });
  readonly phrases = computed(() => [{ id: 0, phrase: this.activation() }, ...this.draft()]);
  readonly phrase = computed(() => this.phrases().find(c => c.id === this.selected())?.phrase ?? '');
  readonly totalLearned = computed(() => this.phrases().filter(c => this.isLearned(c.id)).length);
  readonly complete = computed(() => this.totalLearned() === this.phrases().length);
  readonly canRecord = computed(() => !this.operating() && this.boardMatches()
    && this.studio.status()?.learningSlot === this.selected()
    && ['ready', 'repeat'].includes(this.studio.status()?.learningState ?? ''));
  readonly canPrepare = computed(() => !this.operating() && this.boardMatches()
    && this.studio.status()?.learningSlot == null);
  readonly feedback = computed(() => {
    const status = this.studio.status();
    if (!status?.verified) return 'Placa desconectada';
    if (status.learningSlot !== this.selected()) return this.isLearned(this.selected()) ? 'Guardada en la placa' : 'Pendiente de grabar';
    const labels: Record<string, string> = { starting: 'Preparando la frase…', ready: 'Lista para grabar', 'recording-start': 'Abriendo el micrófono…', listening: 'Escuchando…', repeat: 'Primera toma recibida. Repite la frase.' };
    return labels[status.learningState] ?? 'Preparando…';
  });
  readonly recordLabel = computed(() => this.studio.status()?.learningTake === 2 ? 'Grabar segunda toma' : 'Grabar primera toma');
  readonly recentEvents = computed(() => (this.studio.status()?.events ?? []).filter(e => !e.text.includes('[DEBUG')).slice(-3).reverse());

  constructor() {
    void this.initialize();
    const timer = setInterval(() => void this.studio.poll(), 350);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }
  async initialize(): Promise<void> {
    await this.studio.refresh();
    this.draft.set(this.studio.project()?.commands.map(c => ({ ...c })) ?? []);
    this.port.set(this.studio.status()?.port ?? this.studio.ports()[0]?.path ?? '');
    this.ready.set(!!this.studio.project());
  }
  resume(): void {
    if (!this.canNavigate(3)) return;
    this.loaded.set(true);
    const next = this.phrases().find(c => !this.isLearned(c.id));
    this.selected.set(next?.id ?? 0);
    this.step.set(3);
  }
  canNavigate(stage: number): boolean {
    if (!this.connected() || !this.ready() || this.operating() || this.studio.status()?.learningSlot != null) return false;
    return stage <= 1 || (stage === 2 && (this.buildMatches() || this.boardMatches())) || (stage === 3 && this.boardMatches());
  }
  goTo(stage: number): void {
    if (this.canNavigate(stage)) this.step.set(stage);
  }
  update(id: number, key: 'phrase' | 'message', value: string): void {
    this.draft.update(items => items.map(c => c.id === id ? { ...c, [key]: value } : c));
    this.compiled.set(false); this.loaded.set(false);
  }
  trackCommand(_index: number, command: VoiceCommand): number { return command.id; }
  add(): void {
    const id = Array.from({ length: 10 }, (_, i) => i + 1).find(n => !this.draft().some(c => c.id === n));
    if (id !== undefined) this.draft.update(items => [...items, { id, phrase: '', message: 'COMANDO_' + id, action: '' }]);
  }
  remove(id: number): void { this.draft.update(items => items.filter(c => c.id !== id)); }
  async save(): Promise<void> {
    if (!this.valid() || this.operating()) return;
    await this.studio.action('project', { ...this.studio.project(), commands: this.draft() });
    if (!this.studio.error()) { this.compiled.set(false); this.loaded.set(false); this.step.set(1); }
  }
  async compile(): Promise<void> {
    if (this.operating() || !this.valid() || !this.connected()) return;
    if (!this.matchesProject()) {
      await this.studio.action('project', { ...this.studio.project(), commands: this.draft() });
      if (this.studio.error()) return;
      this.draft.set(this.studio.project()?.commands.map(c => ({ ...c })) ?? []);
    }
    this.compiled.set(false);
    await this.studio.action('compile');
    if (!this.studio.error() && this.studio.status()?.firmwareReady) this.compiled.set(true);
  }
  async flash(): Promise<void> {
    if (!this.buildMatches() || !this.eraseAccepted() || !this.port() || this.operating()) return;
    await this.studio.action('flash', { port: this.port() });
    if (!this.studio.error() && this.studio.status()?.flashed && this.studio.status()?.verified) {
      this.loaded.set(true); this.selected.set(0); this.step.set(3);
    }
  }
  async connect(): Promise<void> { await this.studio.action('connect', { port: this.port() }); }
  isLearned(id: number): boolean { return this.studio.status()?.learned.includes(id) ?? false; }
  select(id: number): void { if (this.canPrepare()) this.selected.set(id); }
  async prepare(): Promise<void> {
    if (!this.canPrepare()) return;
    if (this.isLearned(this.selected()) && !window.confirm(this.language.translate('Volver a grabar esta frase sustituirá su grabación actual. ¿Continuar?'))) return;
    await this.studio.action('learn', { id: this.selected() });
  }
  async nextPhrase(): Promise<void> {
    if (!this.isLearned(this.selected()) || !this.canPrepare()) return;
    const next = this.phrases().find(c => !this.isLearned(c.id));
    if (next) this.selected.set(next.id);
  }
  back(): void {
    this.goTo(Math.max(0, this.step() - 1));
  }
}
