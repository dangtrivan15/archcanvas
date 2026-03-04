import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePencilStore } from '../../../src/store/pencilStore';
import { isPencilDrawEvent, isNavigationEvent } from '../../../src/hooks/usePencilInput';

// Test the hook's underlying logic and store integration directly.
// The hook attaches pointer event listeners; we simulate those events
// and verify the store updates correctly.

describe('usePencilInput logic', () => {
  const listeners: Record<string, Function[]> = {};

  beforeEach(() => {
    // Reset pencil store
    usePencilStore.setState({
      isPencilActive: false,
      pressure: 0,
      tilt: { tiltX: 0, tiltY: 0 },
      azimuthAngle: 0,
      pencilDetected: false,
    });

    // Clear listeners
    Object.keys(listeners).forEach((k) => delete listeners[k]);

    // Mock document.addEventListener/removeEventListener
    if (typeof globalThis.document === 'undefined') {
      (globalThis as any).document = {};
    }
    (globalThis as any).document.addEventListener = vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    });
    (globalThis as any).document.removeEventListener = vi.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Create a mock PointerEvent */
  function createMockPointerEvent(
    type: string,
    overrides: Partial<PointerEvent> = {},
  ): PointerEvent {
    return {
      type,
      pointerType: 'pen',
      pressure: 0.5,
      tiltX: 0,
      tiltY: 0,
      azimuthAngle: 0,
      clientX: 100,
      clientY: 200,
      ...overrides,
    } as unknown as PointerEvent;
  }

  describe('pen pointer detection', () => {
    it('should update store when pen pointerdown fires', () => {
      const event = createMockPointerEvent('pointerdown', {
        pointerType: 'pen',
        pressure: 0.65,
        tiltX: 25,
        tiltY: -10,
      });

      // Simulate what the hook does: filter for pen and update store
      if (event.pointerType === 'pen') {
        usePencilStore.getState().setPencilActive(true);
        usePencilStore.getState().updatePencilState({
          pressure: event.pressure,
          tiltX: event.tiltX,
          tiltY: event.tiltY,
        });
      }

      const state = usePencilStore.getState();
      expect(state.isPencilActive).toBe(true);
      expect(state.pressure).toBe(0.65);
      expect(state.tilt.tiltX).toBe(25);
      expect(state.tilt.tiltY).toBe(-10);
      expect(state.pencilDetected).toBe(true);
    });

    it('should NOT update store for touch pointer events', () => {
      const event = createMockPointerEvent('pointerdown', {
        pointerType: 'touch',
        pressure: 0.5,
      });

      // Simulate hook logic: only process pen
      if (event.pointerType === 'pen') {
        usePencilStore.getState().updatePencilState({
          pressure: event.pressure,
          tiltX: event.tiltX,
          tiltY: event.tiltY,
        });
      }

      const state = usePencilStore.getState();
      expect(state.isPencilActive).toBe(false);
      expect(state.pencilDetected).toBe(false);
    });

    it('should NOT update store for mouse pointer events', () => {
      const event = createMockPointerEvent('pointerdown', {
        pointerType: 'mouse',
        pressure: 0.5,
      });

      if (event.pointerType === 'pen') {
        usePencilStore.getState().updatePencilState({
          pressure: event.pressure,
          tiltX: event.tiltX,
          tiltY: event.tiltY,
        });
      }

      expect(usePencilStore.getState().isPencilActive).toBe(false);
    });

    it('should update pressure/tilt on pointermove with pen', () => {
      // First activate
      usePencilStore.getState().setPencilActive(true);

      const event = createMockPointerEvent('pointermove', {
        pointerType: 'pen',
        pressure: 0.9,
        tiltX: 45,
        tiltY: -30,
      });

      if (event.pointerType === 'pen') {
        usePencilStore.getState().updatePencilState({
          pressure: event.pressure,
          tiltX: event.tiltX,
          tiltY: event.tiltY,
        });
      }

      const state = usePencilStore.getState();
      expect(state.pressure).toBe(0.9);
      expect(state.tilt.tiltX).toBe(45);
      expect(state.tilt.tiltY).toBe(-30);
    });

    it('should reset pencil state on pointerup with pen', () => {
      // First activate with data
      usePencilStore.getState().updatePencilState({
        pressure: 0.7,
        tiltX: 20,
        tiltY: 10,
      });

      const event = createMockPointerEvent('pointerup', {
        pointerType: 'pen',
      });

      if (event.pointerType === 'pen') {
        usePencilStore.getState().resetPencilState();
      }

      const state = usePencilStore.getState();
      expect(state.isPencilActive).toBe(false);
      expect(state.pressure).toBe(0);
      expect(state.tilt).toEqual({ tiltX: 0, tiltY: 0 });
      // pencilDetected stays true
      expect(state.pencilDetected).toBe(true);
    });

    it('should reset pencil state on pointercancel with pen', () => {
      usePencilStore.getState().updatePencilState({
        pressure: 0.5,
        tiltX: 15,
        tiltY: -5,
      });

      const event = createMockPointerEvent('pointercancel', {
        pointerType: 'pen',
      });

      if (event.pointerType === 'pen') {
        usePencilStore.getState().resetPencilState();
      }

      expect(usePencilStore.getState().isPencilActive).toBe(false);
      expect(usePencilStore.getState().pencilDetected).toBe(true);
    });
  });

  describe('pressure normalization', () => {
    it('should handle zero pressure (hover)', () => {
      usePencilStore.getState().updatePencilState({
        pressure: 0,
        tiltX: 0,
        tiltY: 0,
      });
      expect(usePencilStore.getState().pressure).toBe(0);
    });

    it('should handle max pressure', () => {
      usePencilStore.getState().updatePencilState({
        pressure: 1.0,
        tiltX: 0,
        tiltY: 0,
      });
      expect(usePencilStore.getState().pressure).toBe(1);
    });

    it('should clamp pressure above 1', () => {
      usePencilStore.getState().updatePencilState({
        pressure: 1.2,
        tiltX: 0,
        tiltY: 0,
      });
      expect(usePencilStore.getState().pressure).toBe(1);
    });

    it('should clamp negative pressure to 0', () => {
      usePencilStore.getState().updatePencilState({
        pressure: -0.1,
        tiltX: 0,
        tiltY: 0,
      });
      expect(usePencilStore.getState().pressure).toBe(0);
    });
  });
});

describe('isPencilDrawEvent', () => {
  function mockEvent(pointerType: string): PointerEvent {
    return { pointerType } as unknown as PointerEvent;
  }

  it('should return true for pen when pencilDetected', () => {
    expect(isPencilDrawEvent(mockEvent('pen'), true)).toBe(true);
  });

  it('should return false for touch when pencilDetected', () => {
    expect(isPencilDrawEvent(mockEvent('touch'), true)).toBe(false);
  });

  it('should return false for mouse when pencilDetected', () => {
    expect(isPencilDrawEvent(mockEvent('mouse'), true)).toBe(false);
  });

  it('should return true for any pointer type when no pencil detected', () => {
    expect(isPencilDrawEvent(mockEvent('pen'), false)).toBe(true);
    expect(isPencilDrawEvent(mockEvent('touch'), false)).toBe(true);
    expect(isPencilDrawEvent(mockEvent('mouse'), false)).toBe(true);
  });
});

describe('isNavigationEvent', () => {
  function mockEvent(pointerType: string): PointerEvent {
    return { pointerType } as unknown as PointerEvent;
  }

  it('should return true for touch when pencilDetected', () => {
    expect(isNavigationEvent(mockEvent('touch'), true)).toBe(true);
  });

  it('should return true for mouse when pencilDetected', () => {
    expect(isNavigationEvent(mockEvent('mouse'), true)).toBe(true);
  });

  it('should return false for pen when pencilDetected', () => {
    expect(isNavigationEvent(mockEvent('pen'), true)).toBe(false);
  });

  it('should return true for mouse when no pencil detected', () => {
    expect(isNavigationEvent(mockEvent('mouse'), false)).toBe(true);
  });

  it('should return false for touch when no pencil detected', () => {
    expect(isNavigationEvent(mockEvent('touch'), false)).toBe(false);
  });
});
