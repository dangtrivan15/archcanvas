/**
 * Pencil store — Apple Pencil pressure & tilt state.
 *
 * Tracks whether an Apple Pencil (or any stylus with pointerType === 'pen') is
 * active, along with normalized pressure, tilt, and azimuth data from PointerEvents.
 *
 * Used by the usePencilInput hook to expose pencil state to the rest of the app.
 */

import { create } from 'zustand';

export interface PencilTilt {
  /** Tilt angle along the X axis, in degrees (-90 to 90) */
  tiltX: number;
  /** Tilt angle along the Y axis, in degrees (-90 to 90) */
  tiltY: number;
}

export interface PencilStoreState {
  /** Whether an Apple Pencil / stylus is currently in contact with the screen */
  isPencilActive: boolean;
  /** Normalized pressure from 0 (no pressure) to 1 (max pressure) */
  pressure: number;
  /** Tilt angles from the PointerEvent */
  tilt: PencilTilt;
  /** Azimuth angle in radians (0 to 2π), if available */
  azimuthAngle: number;
  /** Whether a pencil has ever been detected this session */
  pencilDetected: boolean;

  // Actions
  /** Update pencil state from a PointerEvent */
  updatePencilState: (data: {
    pressure: number;
    tiltX: number;
    tiltY: number;
    azimuthAngle?: number;
  }) => void;
  /** Mark pencil as active (pointerdown with pen) */
  setPencilActive: (active: boolean) => void;
  /** Reset pencil state (on pointerup / pointercancel) */
  resetPencilState: () => void;
}

export const usePencilStore = create<PencilStoreState>((set) => ({
  isPencilActive: false,
  pressure: 0,
  tilt: { tiltX: 0, tiltY: 0 },
  azimuthAngle: 0,
  pencilDetected: false,

  updatePencilState: (data) =>
    set({
      isPencilActive: true,
      pressure: Math.max(0, Math.min(1, data.pressure)),
      tilt: {
        tiltX: data.tiltX,
        tiltY: data.tiltY,
      },
      azimuthAngle: data.azimuthAngle ?? 0,
      pencilDetected: true,
    }),

  setPencilActive: (active) =>
    set((s) => ({
      isPencilActive: active,
      pencilDetected: active ? true : s.pencilDetected,
    })),

  resetPencilState: () =>
    set({
      isPencilActive: false,
      pressure: 0,
      tilt: { tiltX: 0, tiltY: 0 },
      azimuthAngle: 0,
    }),
}));
