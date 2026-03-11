import '@testing-library/jest-dom';

/**
 * Node.js 25+ provides a built-in localStorage global that lacks methods
 * (clear, getItem, setItem, removeItem) unless --localstorage-file is set.
 * This conflicts with happy-dom's working localStorage. Polyfill when needed.
 */
if (typeof localStorage !== 'undefined' && typeof localStorage.clear !== 'function') {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, String(value)); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    } as Storage,
    writable: true,
    configurable: true,
  });
}
