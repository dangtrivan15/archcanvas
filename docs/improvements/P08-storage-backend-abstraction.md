# P08: Storage Backend Abstraction

**Parallel safety**: PARTIALLY DEPENDENT. Benefits from P06 (Platform Abstraction) being
done first since both touch file I/O. If running in parallel, coordinate on
`src/core/storage/` file ownership. P06 handles platform-level file dialogs,
P08 handles the storage/encoding layer.

---

## Problem

### File I/O Coupled to Browser APIs

`src/store/coreStore.ts` directly uses `FileSystemFileHandle`:
```typescript
const savedFile = await (fileHandle as FileSystemFileHandle).getFile();
```

`src/core/storage/fileIO.ts` (752 lines) mixes:
- Proto encoding/decoding (good, should keep)
- File handle management (should abstract)
- Undo history serialization (should separate)

### No Way to Add Storage Backends

Adding cloud sync, git integration, or collaborative editing would require
touching `coreStore.ts` and `fileIO.ts` directly.

### Undo History is in FileIO

Undo entry serialization is interleaved with file I/O logic in `fileIO.ts`.
These are separate concerns.

---

## Proposed Solution

### A. Storage Backend Interface

```typescript
// src/core/storage/types.ts
export interface StorageBackend {
  readonly type: string; // 'file-system-access' | 'file-download' | 'capacitor' | 'tauri'

  // Read/write raw bytes
  read(handle: StorageHandle): Promise<Uint8Array>;
  write(handle: StorageHandle, data: Uint8Array): Promise<StorageHandle>;

  // File operations
  openFilePicker(options?: OpenOptions): Promise<StorageHandle | null>;
  saveFilePicker(data: Uint8Array, options?: SaveOptions): Promise<StorageHandle>;

  // Watch for external changes (optional)
  watch?(handle: StorageHandle, cb: (event: FileChangeEvent) => void): () => void;

  // Capabilities
  readonly capabilities: {
    supportsDirectWrite: boolean;   // Save in place (vs download)
    supportsWatch: boolean;         // File change monitoring
    supportsListDirectory: boolean; // Project folder listing
  };
}

// Opaque handle — different backends use different underlying types
export type StorageHandle = {
  readonly backend: string;
  readonly name: string;          // Display name
  readonly path?: string;         // Full path if available
  readonly _internal: unknown;    // Backend-specific data
};
```

### B. Backend Implementations

```
src/core/storage/
  types.ts                       -- Interfaces
  codec.ts                       -- Keep: binary encode/decode (magic + proto)
  fileIO.ts                      -- Simplify: only proto conversion logic
  storageManager.ts              -- New: manages active backend + handles
  backends/
    fileSystemAccess.ts          -- Chrome File System Access API
    fileDownload.ts              -- Fallback: Blob download for save, input for open
    capacitor.ts                 -- iOS Capacitor filesystem
    tauri.ts                     -- Tauri filesystem commands
    inMemory.ts                  -- For testing
```

#### File System Access Backend (Chrome)

```typescript
// src/core/storage/backends/fileSystemAccess.ts
export class FileSystemAccessBackend implements StorageBackend {
  readonly type = 'file-system-access';
  readonly capabilities = {
    supportsDirectWrite: true,
    supportsWatch: true,
    supportsListDirectory: true,
  };

  async openFilePicker(): Promise<StorageHandle | null> {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'ArchCanvas files', accept: { 'application/octet-stream': ['.archc'] } }],
    });
    return { backend: this.type, name: handle.name, _internal: handle };
  }

  async read(handle: StorageHandle): Promise<Uint8Array> {
    const fsHandle = handle._internal as FileSystemFileHandle;
    const file = await fsHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  async write(handle: StorageHandle, data: Uint8Array): Promise<StorageHandle> {
    const fsHandle = handle._internal as FileSystemFileHandle;
    const writable = await fsHandle.createWritable();
    await writable.write(data);
    await writable.close();
    return handle;
  }
}
```

#### File Download Backend (Fallback)

```typescript
// src/core/storage/backends/fileDownload.ts
export class FileDownloadBackend implements StorageBackend {
  readonly type = 'file-download';
  readonly capabilities = {
    supportsDirectWrite: false,  // Can only download
    supportsWatch: false,
    supportsListDirectory: false,
  };

  async openFilePicker(): Promise<StorageHandle | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.archc';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) resolve({ backend: this.type, name: file.name, _internal: file });
        else resolve(null);
      };
      input.click();
    });
  }

  async read(handle: StorageHandle): Promise<Uint8Array> {
    const file = handle._internal as File;
    return new Uint8Array(await file.arrayBuffer());
  }

  async write(_handle: StorageHandle, data: Uint8Array): Promise<StorageHandle> {
    // Download the file
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = _handle.name;
    a.click();
    URL.revokeObjectURL(url);
    return _handle;
  }
}
```

#### In-Memory Backend (Testing)

```typescript
// src/core/storage/backends/inMemory.ts
export class InMemoryBackend implements StorageBackend {
  readonly type = 'in-memory';
  private files = new Map<string, Uint8Array>();
  readonly capabilities = { supportsDirectWrite: true, supportsWatch: false, supportsListDirectory: true };

  async read(handle: StorageHandle): Promise<Uint8Array> {
    return this.files.get(handle.name) ?? new Uint8Array();
  }

  async write(handle: StorageHandle, data: Uint8Array): Promise<StorageHandle> {
    this.files.set(handle.name, data);
    return handle;
  }
}
```

### C. Storage Manager

Coordinates between the active backend and the file I/O pipeline:

```typescript
// src/core/storage/storageManager.ts
export class StorageManager {
  private backend: StorageBackend;

  constructor(backend: StorageBackend) {
    this.backend = backend;
  }

  async openArchitecture(): Promise<{ graph: ArchGraph; handle: StorageHandle } | null> {
    const handle = await this.backend.openFilePicker();
    if (!handle) return null;

    const bytes = await this.backend.read(handle);
    const graph = decodeArchcFile(bytes); // from codec.ts
    return { graph, handle };
  }

  async saveArchitecture(graph: ArchGraph, handle: StorageHandle): Promise<StorageHandle> {
    const bytes = encodeArchcFile(graph); // from codec.ts
    return this.backend.write(handle, bytes);
  }

  async saveArchitectureAs(graph: ArchGraph, suggestedName: string): Promise<StorageHandle> {
    const bytes = encodeArchcFile(graph);
    return this.backend.saveFilePicker(bytes, { suggestedName });
  }
}
```

### D. Auto-Sidecar Generation

When saving, automatically generate companion files:

```typescript
// In storageManager.ts
async saveArchitecture(graph: ArchGraph, handle: StorageHandle): Promise<StorageHandle> {
  const bytes = encodeArchcFile(graph);
  const result = await this.backend.write(handle, bytes);

  // Generate sidecar files if backend supports directory write
  if (this.backend.capabilities.supportsDirectWrite) {
    const markdownSidecar = generateMarkdownSummary(graph);
    const sidecarHandle = { ...handle, name: `${handle.name}.summary.md` };
    await this.backend.write(sidecarHandle, new TextEncoder().encode(markdownSidecar));
  }

  return result;
}
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/core/storage/fileIO.ts` | Simplify to proto conversion only (~200 lines) |
| `src/core/storage/codec.ts` | Keep as-is (already focused) |
| `src/store/coreStore.ts` | Replace direct file handle usage with StorageManager |

**New files:**
- `src/core/storage/types.ts`
- `src/core/storage/storageManager.ts`
- `src/core/storage/backends/fileSystemAccess.ts`
- `src/core/storage/backends/fileDownload.ts`
- `src/core/storage/backends/capacitor.ts`
- `src/core/storage/backends/inMemory.ts`

---

## Acceptance Criteria

1. No direct `FileSystemFileHandle` usage outside storage backends
2. Open/save works on Chrome (File System Access)
3. Open/save works on Firefox/Safari (file download fallback)
4. In-memory backend enables testing without browser APIs
5. fileIO.ts is under 300 lines (only proto conversion)
6. Sidecar `.summary.md` still generated on save
7. `npm run test` passes
8. `npm run build` succeeds
