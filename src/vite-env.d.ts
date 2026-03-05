/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ─── Extended PointerEvent with azimuthAngle (Safari/iPadOS) ───
interface PointerEventWithAzimuth extends PointerEvent {
  /** Azimuth angle in radians (Apple Pencil, available on Safari/iPadOS) */
  readonly azimuthAngle?: number;
}

// ─── Navigator User-Agent Client Hints API (Chrome 90+) ───
interface NavigatorUAData {
  readonly platform: string;
  readonly mobile: boolean;
  readonly brands: ReadonlyArray<{ brand: string; version: string }>;
}

interface Navigator {
  readonly userAgentData?: NavigatorUAData;
}

// File System Access API types (Chrome/Edge)
interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  readonly name: string;
  readonly kind: 'file';
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: Uint8Array | string | Blob): Promise<void>;
  close(): Promise<void>;
}

interface OpenFilePickerOptions {
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
}

interface Window {
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}

// PWA virtual module types (vite-plugin-pwa)
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

// Allow importing YAML files
declare module '*.yaml' {
  const content: Record<string, unknown>;
  export default content;
}

declare module '*.yml' {
  const content: Record<string, unknown>;
  export default content;
}
