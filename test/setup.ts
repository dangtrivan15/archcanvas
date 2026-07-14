import "@testing-library/jest-dom/vitest";

// happy-dom does not implement the File System Access API. Default it to
// "supported" (the common Chromium case) so existing fileStore/store tests
// that inject a mock FilePicker via setFilePicker() — and don't care about
// real browser capability detection — aren't affected by the unsupported-
// browser gate in fileStore.open(). Tests that specifically exercise the
// unsupported-browser path (e.g. ProjectGate, fileStore.open() guard tests)
// delete this in their own beforeEach/test and restore it in afterEach.
if (typeof window !== "undefined" && !("showDirectoryPicker" in window)) {
  (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker =
    () => Promise.resolve();
}

// Node.js v25+ exposes an experimental `localStorage` on globalThis, but
// without a valid `--localstorage-file` path all its methods are undefined.
// This shadows happy-dom's implementation (happy-dom sees the property exists
// and skips its own setup). Replace it with a spec-compliant Map-backed shim.
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.clear !== "function"
) {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  } as Storage;
}
