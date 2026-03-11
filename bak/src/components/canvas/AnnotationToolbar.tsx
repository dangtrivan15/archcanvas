/**
 * AnnotationToolbar — floating toolbar for annotation drawing controls.
 *
 * Provides: color picker, stroke width slider, eraser toggle, undo stroke, clear all.
 * Appears when annotation/drawing mode is active.
 */

import { Eraser, Undo2, Trash2, X, Minus, Plus } from 'lucide-react';
import { useAnnotationStore, ANNOTATION_COLORS } from '@/store/annotationStore';
import { useGraphStore } from '@/store/graphStore';

export function AnnotationToolbar() {
  const isDrawingMode = useAnnotationStore((s) => s.isDrawingMode);
  const isEraserMode = useAnnotationStore((s) => s.isEraserMode);
  const color = useAnnotationStore((s) => s.color);
  const strokeWidth = useAnnotationStore((s) => s.strokeWidth);
  const exitDrawingMode = useAnnotationStore((s) => s.exitDrawingMode);
  const toggleEraserMode = useAnnotationStore((s) => s.toggleEraserMode);
  const setColor = useAnnotationStore((s) => s.setColor);
  const setStrokeWidth = useAnnotationStore((s) => s.setStrokeWidth);
  const popUndo = useAnnotationStore((s) => s.popUndo);
  const removeAnnotation = useGraphStore((s) => s.removeAnnotation);
  const clearAnnotations = useGraphStore((s) => s.clearAnnotations);
  const undoStackLength = useAnnotationStore((s) => s.undoStack.length);

  if (!isDrawingMode) return null;

  const handleUndo = () => {
    const lastId = popUndo();
    if (lastId) {
      removeAnnotation(lastId);
    }
  };

  const handleClearAll = () => {
    clearAnnotations();
    useAnnotationStore.getState().clearUndoStack();
  };

  const decreaseWidth = () => setStrokeWidth(Math.max(1, strokeWidth - 1));
  const increaseWidth = () => setStrokeWidth(Math.min(20, strokeWidth + 1));

  return (
    <div
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                 bg-[hsl(var(--surface))] border border-[hsl(var(--border))]
                 rounded-xl shadow-lg px-3 py-2"
      data-testid="annotation-toolbar"
    >
      {/* Color picker */}
      <div className="flex items-center gap-1" data-testid="annotation-colors">
        {ANNOTATION_COLORS.map((c) => (
          <button
            key={c}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c && !isEraserMode
                ? 'border-[hsl(var(--text))] scale-110'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
            title={`Color: ${c}`}
            data-testid={`annotation-color-${c}`}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[hsl(var(--border))]" />

      {/* Stroke width */}
      <div className="flex items-center gap-1" data-testid="annotation-stroke-width">
        <button
          onClick={decreaseWidth}
          className="p-1 rounded hover:bg-[hsl(var(--highlight-low))] text-[hsl(var(--text))]"
          title="Decrease stroke width"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span
          className="text-xs tabular-nums w-6 text-center text-[hsl(var(--text))]"
          data-testid="annotation-stroke-value"
        >
          {strokeWidth}
        </span>
        <button
          onClick={increaseWidth}
          className="p-1 rounded hover:bg-[hsl(var(--highlight-low))] text-[hsl(var(--text))]"
          title="Increase stroke width"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[hsl(var(--border))]" />

      {/* Eraser toggle */}
      <button
        onClick={toggleEraserMode}
        className={`p-1.5 rounded-md transition-colors ${
          isEraserMode
            ? 'bg-[hsl(var(--pine))] text-white'
            : 'hover:bg-[hsl(var(--highlight-low))] text-[hsl(var(--text))]'
        }`}
        title="Eraser mode"
        data-testid="annotation-eraser"
      >
        <Eraser className="w-4 h-4" />
      </button>

      {/* Undo stroke */}
      <button
        onClick={handleUndo}
        disabled={undoStackLength === 0}
        className="p-1.5 rounded-md hover:bg-[hsl(var(--highlight-low))] text-[hsl(var(--text))]
                   disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo last stroke"
        data-testid="annotation-undo"
      >
        <Undo2 className="w-4 h-4" />
      </button>

      {/* Clear all */}
      <button
        onClick={handleClearAll}
        className="p-1.5 rounded-md hover:bg-red-500/20 text-red-500"
        title="Clear all annotations"
        data-testid="annotation-clear-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-[hsl(var(--border))]" />

      {/* Exit drawing mode */}
      <button
        onClick={exitDrawingMode}
        className="p-1.5 rounded-md hover:bg-[hsl(var(--highlight-low))] text-[hsl(var(--text))]"
        title="Exit annotation mode"
        data-testid="annotation-exit"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
