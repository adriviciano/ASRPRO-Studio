import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StudioApiService {
  async get<T>(path: string): Promise<T> { return this.request<T>(path); }
  async post<T>(path: string, body: unknown = {}): Promise<T> { return this.request<T>(path, body); }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch('/api/' + path, body === undefined ? undefined : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const value: unknown = await response.json();
    if (!response.ok) {
      const error = value as { error?: string };
      throw new Error(error.error ?? 'No se pudo completar la operacion.');
    }
    return value as T;
  }
}
