/**
 * ResizeHandle - A draggable divider for resizing panels.
 *
 * Usage:
 *   <ResizeHandle side="left" onResize={(delta) => setWidth(w + delta)} />
 *
 * The `side` prop determines which panel the handle resizes:
 * - "left": placed between left panel and canvas. Dragging right increases left panel width.
 * - "right": placed between canvas and right panel. Dragging left increases right panel width.
 */

import { useCallback, useRef, useEffect, useState } from 'react';

export interface ResizeHandleProps {
  /** Which side panel this handle resizes */
  side: 'left' | 'right';
  /** Called with the pixel delta on each mouse move during drag */
  onResize: (delta: number) => void;
  /** Optional test id override */
  testId?: string;
}

export function ResizeHandle({ side, onResize, testId }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      startXRef.current = e.clientX;

      // For the right panel, dragging left (negative delta) should increase width
      if (side === 'right') {
        onResize(-delta);
      } else {
        onResize(delta);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Attach to document so drags work even if cursor leaves the handle
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, side, onResize]);

  return (
    <div
      data-testid={testId || `resize-handle-${side}`}
      className={`
        w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500
        transition-colors duration-150 shrink-0 z-10
        ${isDragging ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-300'}
      `}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} panel`}
    />
  );
}
