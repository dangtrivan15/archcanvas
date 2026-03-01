/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
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
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

interface Window {
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
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
