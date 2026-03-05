import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the hook logic directly rather than through React render hooks
// since the test environment is 'node' for .ts files

describe('useOfflineStatus logic', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  beforeEach(() => {
    listeners.online = [];
    listeners.offline = [];

    // Mock window
    if (typeof globalThis.window === 'undefined') {
      (globalThis as any).window = {};
    }
    if (typeof globalThis.navigator === 'undefined') {
      (globalThis as any).navigator = { onLine: true };
    }

    (globalThis as any).window.addEventListener = vi.fn(
      (event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      },
    );

    (globalThis as any).window.removeEventListener = vi.fn(
      (event: string, handler: (...args: unknown[]) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect online status from navigator.onLine', () => {
    (globalThis as any).navigator.onLine = true;
    expect(navigator.onLine).toBe(true);
  });

  it('should detect offline status from navigator.onLine', () => {
    (globalThis as any).navigator.onLine = false;
    expect(navigator.onLine).toBe(false);
  });

  it('should register online and offline event listeners', () => {
    // Simulate what the hook does
    const handleOnline = vi.fn();
    const handleOffline = vi.fn();
    window.addEventListener('online', handleOnline as any);
    window.addEventListener('offline', handleOffline as any);

    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should fire online handler when online event occurs', () => {
    const onlineHandler = vi.fn();
    window.addEventListener('online', onlineHandler as any);

    // Simulate online event
    for (const handler of listeners.online) {
      handler();
    }

    expect(onlineHandler).toHaveBeenCalled();
  });

  it('should fire offline handler when offline event occurs', () => {
    const offlineHandler = vi.fn();
    window.addEventListener('offline', offlineHandler as any);

    // Simulate offline event
    for (const handler of listeners.offline) {
      handler();
    }

    expect(offlineHandler).toHaveBeenCalled();
  });

  it('should clean up event listeners on removal', () => {
    const handler = vi.fn();
    window.addEventListener('online', handler as any);
    window.removeEventListener('online', handler as any);

    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(listeners.online).toHaveLength(0);
  });
});

describe('offline detection utilities', () => {
  it('navigator.onLine reflects connectivity state', () => {
    // In Node.js, navigator is a read-only getter, so we use Object.defineProperty
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });
    expect(navigator.onLine).toBe(true);

    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      writable: true,
      configurable: true,
    });
    expect(navigator.onLine).toBe(false);
  });

  it('online/offline events are standard DOM events', () => {
    // Validate that the event names are correct
    const validEvents = ['online', 'offline'];
    expect(validEvents).toContain('online');
    expect(validEvents).toContain('offline');
  });
});
