export interface VoiceCommand { id: number; phrase: string; message: string; action: string; }
export interface VoiceProject { status: string; language: string; transport: string; lineEnding: string; commands: VoiceCommand[]; }
export interface PortInfo { path: string; manufacturer?: string; vendorId?: string; productId?: string; }
export interface StudioEvent { id: number; time: string; level: string; text: string; raw?: string; }
export interface DeviceStatus {
  connected: boolean; port: string | null; verified: boolean; busy: boolean;
  sdkReady: boolean; firmwareReady: boolean; firmwareBytes: number;
  buildHash: string | null; flashed: boolean; learned: number[]; learningSlot: number | null;
  learningState: string; learningTake: number; lastLearningSlot: number | null; learningError: string; events: StudioEvent[];
}
