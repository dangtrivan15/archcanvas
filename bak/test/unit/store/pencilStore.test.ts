import { describe, it, expect, beforeEach } from 'vitest';
import { usePencilStore } from '../../../src/store/pencilStore';

describe('pencilStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    usePencilStore.setState({
      isPencilActive: false,
      pressure: 0,
      tilt: { tiltX: 0, tiltY: 0 },
      azimuthAngle: 0,
      pencilDetected: false,
    });
  });

  describe('initial state', () => {
    it('should start with pencil inactive', () => {
      const state = usePencilStore.getState();
      expect(state.isPencilActive).toBe(false);
      expect(state.pressure).toBe(0);
      expect(state.tilt).toEqual({ tiltX: 0, tiltY: 0 });
      expect(state.azimuthAngle).toBe(0);
      expect(state.pencilDetected).toBe(false);
    });
  });

  describe('updatePencilState', () => {
    it('should set pencil active and update pressure/tilt data', () => {
      usePencilStore.getState().updatePencilState({
        pressure: 0.75,
        tiltX: 30,
        tiltY: -15,
        azimuthAngle: 1.5,
      });

      const state = usePencilStore.getState();
      expect(state.isPencilActive).toBe(true);
      expect(state.pressure).toBe(0.75);
      expect(state.tilt.tiltX).toBe(30);
      expect(state.tilt.tiltY).toBe(-15);
      expect(state.azimuthAngle).toBe(1.5);
      expect(state.pencilDetected).toBe(true);
    });

    it('should clamp pressure to 0-1 range', () => {
      usePencilStore.getState().updatePencilState({
        pressure: 1.5,
        tiltX: 0,
        tiltY: 0,
      });
      expect(usePencilStore.getState().pressure).toBe(1);

      usePencilStore.getState().updatePencilState({
        pressure: -0.5,
        tiltX: 0,
        tiltY: 0,
      });
      expect(usePencilStore.getState().pressure).toBe(0);
    });

    it('should default azimuthAngle to 0 when not provided', () => {
      usePencilStore.getState().updatePencilState({
        pressure: 0.5,
        tiltX: 10,
        tiltY: 20,
      });
      expect(usePencilStore.getState().azimuthAngle).toBe(0);
    });

    it('should mark pencilDetected as true after first update', () => {
      expect(usePencilStore.getState().pencilDetected).toBe(false);

      usePencilStore.getState().updatePencilState({
        pressure: 0.1,
        tiltX: 0,
        tiltY: 0,
      });

      expect(usePencilStore.getState().pencilDetected).toBe(true);
    });
  });

  describe('setPencilActive', () => {
    it('should set isPencilActive to true and mark pencilDetected', () => {
      usePencilStore.getState().setPencilActive(true);

      const state = usePencilStore.getState();
      expect(state.isPencilActive).toBe(true);
      expect(state.pencilDetected).toBe(true);
    });

    it('should set isPencilActive to false without clearing pencilDetected', () => {
      // First detect pencil
      usePencilStore.getState().setPencilActive(true);
      expect(usePencilStore.getState().pencilDetected).toBe(true);

      // Deactivate
      usePencilStore.getState().setPencilActive(false);
      const state = usePencilStore.getState();
      expect(state.isPencilActive).toBe(false);
      expect(state.pencilDetected).toBe(true); // Still detected
    });
  });

  describe('resetPencilState', () => {
    it('should reset active state and sensor data but preserve pencilDetected', () => {
      // Set up active state
      usePencilStore.getState().updatePencilState({
        pressure: 0.8,
        tiltX: 45,
        tiltY: -30,
        azimuthAngle: 2.0,
      });

      // Reset
      usePencilStore.getState().resetPencilState();

      const state = usePencilStore.getState();
      expect(state.isPencilActive).toBe(false);
      expect(state.pressure).toBe(0);
      expect(state.tilt).toEqual({ tiltX: 0, tiltY: 0 });
      expect(state.azimuthAngle).toBe(0);
      // pencilDetected is NOT reset — once detected, always detected for the session
      expect(state.pencilDetected).toBe(true);
    });
  });
});
