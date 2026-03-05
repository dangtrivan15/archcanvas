/**
 * Annotation store — manages freeform drawing annotations on the canvas.
 *
 * Supports pencil/mouse drawing with pressure-sensitive stroke width,
 * color selection, eraser mode, and undo of individual strokes.
 * Annotations can be scoped to a specific node or be global (canvas-level).
 */

import { create } from 'zustand';
import type { Annotation, AnnotationPathData } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

export interface AnnotationStoreState {
  /** Whether annotation/drawing mode is active */
  isDrawingMode: boolean;
  /** Whether eraser mode is active (within drawing mode) */
  isEraserMode: boolean;
  /** Current drawing color */
  color: string;
  /** Current base stroke width */
  strokeWidth: number;
  /** Currently drawing annotation (in progress) */
  currentAnnotation: {
    points: number[];
    pressures: number[];
  } | null;
  /** Stack of recently completed annotation IDs for undo */
  undoStack: string[];

  // Actions
  enterDrawingMode: () => void;
  exitDrawingMode: () => void;
  toggleEraserMode: () => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  startStroke: (x: number, y: number, pressure: number) => void;
  continueStroke: (x: number, y: number, pressure: number) => void;
  /** Finish current stroke and return the completed annotation data */
  finishStroke: (nodeId?: string) => Annotation | null;
  /** Cancel current stroke without saving */
  cancelStroke: () => void;
  /** Push an annotation ID to undo stack */
  pushUndo: (annotationId: string) => void;
  /** Pop last annotation ID from undo stack */
  popUndo: () => string | null;
  /** Clear the undo stack */
  clearUndoStack: () => void;
}

export const ANNOTATION_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ffffff', // white
  '#000000', // black
];

export const useAnnotationStore = create<AnnotationStoreState>((set, get) => ({
  isDrawingMode: false,
  isEraserMode: false,
  color: '#ef4444',
  strokeWidth: 3,
  currentAnnotation: null,
  undoStack: [],

  enterDrawingMode: () => set({ isDrawingMode: true, isEraserMode: false }),
  exitDrawingMode: () => set({ isDrawingMode: false, isEraserMode: false, currentAnnotation: null }),
  toggleEraserMode: () => set((s) => ({ isEraserMode: !s.isEraserMode })),
  setColor: (color) => set({ color, isEraserMode: false }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),

  startStroke: (x, y, pressure) => {
    set({
      currentAnnotation: {
        points: [x, y],
        pressures: [pressure],
      },
    });
  },

  continueStroke: (x, y, pressure) => {
    const { currentAnnotation } = get();
    if (!currentAnnotation) return;
    set({
      currentAnnotation: {
        points: [...currentAnnotation.points, x, y],
        pressures: [...currentAnnotation.pressures, pressure],
      },
    });
  },

  finishStroke: (nodeId?: string) => {
    const { currentAnnotation, color, strokeWidth } = get();
    if (!currentAnnotation || currentAnnotation.points.length < 4) {
      // Need at least 2 points (4 values)
      set({ currentAnnotation: null });
      return null;
    }

    const annotation: Annotation = {
      id: generateId(),
      paths: [{
        points: currentAnnotation.points,
        pressures: currentAnnotation.pressures,
      }],
      color,
      strokeWidth,
      nodeId,
      timestampMs: Date.now(),
    };

    set({ currentAnnotation: null });
    return annotation;
  },

  cancelStroke: () => set({ currentAnnotation: null }),

  pushUndo: (annotationId) =>
    set((s) => ({ undoStack: [...s.undoStack, annotationId] })),

  popUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const lastId = undoStack[undoStack.length - 1];
    set({ undoStack: undoStack.slice(0, -1) });
    return lastId;
  },

  clearUndoStack: () => set({ undoStack: [] }),
}));
