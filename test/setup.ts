import "@testing-library/jest-dom/vitest";

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
