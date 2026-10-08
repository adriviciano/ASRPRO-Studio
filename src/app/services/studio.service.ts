import { Injectable, inject, signal } from '@angular/core';
import { StudioApiService } from './api/studio-api.service';
import { DeviceStatus, PortInfo, VoiceProject } from '../models/studio';

@Injectable({ providedIn: 'root' })
export class StudioService {
  private readonly api = inject(StudioApiService);
  readonly project = signal<VoiceProject | null>(null);
  readonly ports = signal<PortInfo[]>([]);
  readonly status = signal<DeviceStatus | null>(null);
  readonly error = signal('');
  readonly working = signal(false);

  async refresh(): Promise<void> {
    try {
      const [project, ports, status] = await Promise.all([
        this.api.get<VoiceProject>('project'), this.api.get<PortInfo[]>('ports'), this.api.get<DeviceStatus>('status')
      ]);
      this.project.set(project); this.ports.set(ports); this.status.set(status);
    } catch (error: unknown) { this.report(error); }
  }

  async poll(): Promise<void> {
    try { this.status.set(await this.api.get<DeviceStatus>('status')); } catch (error: unknown) { this.report(error); }
  }

  async action(path: string, body: unknown = {}): Promise<void> {
    this.working.set(true); this.error.set('');
    try { await this.api.post(path, body); await this.refresh(); }
    catch (error: unknown) { this.report(error); }
    finally { this.working.set(false); }
  }

  private report(error: unknown): void { this.error.set(error instanceof Error ? error.message : 'Error de conexion.'); }
}
