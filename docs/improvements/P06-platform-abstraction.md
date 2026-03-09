# P06: Platform Abstraction (Strict Enforcement)

**Parallel safety**: FULLY INDEPENDENT. Touches only `src/core/platform/` files
and scattered direct browser API calls in stores/components.

---

## Problem

### Abstraction Exists but is Inconsistently Used

`src/core/platform/` has a good abstraction layer with adapters for:
- File system (fileSystemAdapter)
- Clipboard (clipboardAdapter)
- Preferences (preferencesAdapter)
- Platform bridge (platformBridge)

But code still directly touches browser APIs:

**Direct localStorage usage:**
- `src/store/uiStore.ts` (lines ~66, ~129) — saves panel state directly to localStorage
- `src/core/shortcuts/shortcutManager.ts` — saves keybindings to localStorage

**Direct FileSystem Access API:**
- `src/store/coreStore.ts` (~line 566):
  ```typescript
  const savedFile = await (fileHandle as FileSystemFileHandle).getFile();
  ```

**Direct navigator calls:**
- Various components check `navigator.userAgent` or `navigator.platform` directly

### No Compile-Time Enforcement

Nothing prevents a developer from writing `localStorage.setItem(...)` instead of
using the platform adapter. The abstraction is optional, not enforced.

---

## Proposed Solution

### A. Complete the Platform Adapter Interface

```typescript
// src/core/platform/types.ts
export interface PlatformAdapter {
  readonly type: 'web' | 'desktop' | 'ios';
  readonly capabilities: PlatformCapabilities;

  // Sub-adapters
  readonly fs: FileSystemAdapter;
  readonly clipboard: ClipboardAdapter;
  readonly preferences: PreferencesAdapter;
  readonly notifications: NotificationAdapter;
  readonly sharing: SharingAdapter;
}

export interface PlatformCapabilities {
  hasFileSystemAccess: boolean;     // Chrome File System Access API
  hasNativeFileDialogs: boolean;    // Electron/Tauri
  hasClaudeCodeBridge: boolean;     // Can connect to local CLI
  supportsBackgroundSync: boolean;
  supportsNotifications: boolean;
  hasTouchInput: boolean;
  hasApplePencil: boolean;
}

export interface FileSystemAdapter {
  openFile(options?: OpenFileOptions): Promise<FileResult | null>;
  saveFile(data: Uint8Array, handle?: FileHandle): Promise<FileHandle>;
  saveFileAs(data: Uint8Array, suggestedName: string): Promise<FileHandle>;
  watchFile(handle: FileHandle, callback: (event: FileChangeEvent) => void): () => void;
  readDirectory(path: string): Promise<DirectoryEntry[]>;
}

export interface PreferencesAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  // No direct localStorage!
}
```

### B. Platform Implementations

```
src/core/platform/
  types.ts              -- Interfaces (updated)
  createPlatform.ts     -- Factory function
  detect.ts             -- Platform detection logic
  web/
    webPlatform.ts      -- Browser implementation
    webFileSystem.ts
    webClipboard.ts
    webPreferences.ts   -- Wraps localStorage
    webNotifications.ts
    webSharing.ts       -- File download
  desktop/
    desktopPlatform.ts  -- Tauri/Electron implementation
    desktopFileSystem.ts
    desktopPreferences.ts
  ios/
    iosPlatform.ts      -- Capacitor implementation
    iosFileSystem.ts
    iosSharing.ts       -- iOS share sheet
```

### C. Platform Injection

Inject the platform at app initialization:

```typescript
// src/main.tsx
import { detectPlatform, createPlatform } from '@/core/platform';

const platformType = detectPlatform(); // 'web' | 'desktop' | 'ios'
const platform = createPlatform(platformType);

// Make available globally via React context or module singleton
setPlatformInstance(platform);

// In stores:
import { getPlatform } from '@/core/platform';
const platform = getPlatform();
await platform.preferences.set('panel.right.open', true);
// NOT: localStorage.setItem('panel.right.open', 'true');
```

### D. ESLint Rule to Enforce Abstraction

Add an ESLint rule that disallows direct browser API usage outside of platform adapters:

```javascript
// eslint.config.js — add rule
{
  rules: {
    'no-restricted-globals': ['error',
      { name: 'localStorage', message: 'Use platform.preferences instead' },
      { name: 'sessionStorage', message: 'Use platform.preferences instead' },
    ],
    'no-restricted-properties': ['error',
      { object: 'navigator', property: 'clipboard', message: 'Use platform.clipboard instead' },
    ],
  },
  // Except in src/core/platform/ files:
  overrides: [{
    files: ['src/core/platform/**'],
    rules: { 'no-restricted-globals': 'off' },
  }],
}
```

### E. Platform Detection

```typescript
// src/core/platform/detect.ts
export function detectPlatform(): 'web' | 'desktop' | 'ios' {
  // Tauri
  if (typeof window !== 'undefined' && '__TAURI__' in window) return 'desktop';

  // Capacitor
  if (typeof window !== 'undefined' && 'Capacitor' in window) {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) return 'ios';
  }

  return 'web';
}
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/core/platform/types.ts` | Expand interfaces |
| `src/core/platform/` (existing files) | Organize into web/desktop/ios subdirs |
| `src/store/uiStore.ts` | Replace `localStorage` with `platform.preferences` |
| `src/core/shortcuts/shortcutManager.ts` | Replace `localStorage` with `platform.preferences` |
| `src/store/coreStore.ts` | Replace direct FileSystemFileHandle with `platform.fs` |
| `src/main.tsx` | Add platform detection and injection |
| `eslint.config.js` | Add no-restricted-globals rule |

**New files:**
- `src/core/platform/createPlatform.ts`
- `src/core/platform/detect.ts`
- `src/core/platform/web/webPlatform.ts`
- `src/core/platform/web/webFileSystem.ts`
- `src/core/platform/web/webPreferences.ts`
- `src/core/platform/web/webClipboard.ts`
- `src/core/platform/web/webNotifications.ts`
- `src/core/platform/web/webSharing.ts`

---

## Acceptance Criteria

1. No `localStorage` or `sessionStorage` usage outside `src/core/platform/`
2. No direct `FileSystemFileHandle` usage outside `src/core/platform/`
3. ESLint rule catches violations
4. Platform detected correctly on web (Chrome + Firefox + Safari)
5. All existing save/load/preferences behaviors work identically
6. `npm run test` passes
7. `npm run build` succeeds
8. `npm run lint` passes (no restricted globals violations)
