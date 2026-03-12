import { useEffect, useRef } from 'react';
import type { CanvasNodeData, CanvasEdgeData } from '@/components/canvas/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextMenuTarget =
  | { kind: 'canvas' }
  | { kind: 'inlineNode'; nodeId: string; nodeData: CanvasNodeData }
  | { kind: 'refNode'; nodeId: string; nodeData: CanvasNodeData }
  | { kind: 'edge'; edgeData: CanvasEdgeData };

export interface ContextMenuState {
  target: ContextMenuTarget;
  x: number;
  y: number;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onCanvasFitView: () => void;
  onNodeEditProperties: (nodeId: string) => void;
  onNodeAddNote: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onRefNodeDiveIn: (nodeId: string) => void;
  onEdgeEdit: (edgeData: CanvasEdgeData) => void;
  onEdgeDelete: (edgeData: CanvasEdgeData) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MenuItemProps {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ label, onClick, danger }: MenuItemProps) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
      }`}
      onMouseDown={(e) => {
        // Use onMouseDown + preventDefault so the click doesn't propagate
        // to the canvas before we execute the action.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-gray-200" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContextMenu({
  menu,
  onClose,
  onCanvasFitView,
  onNodeEditProperties,
  onNodeAddNote,
  onNodeDelete,
  onRefNodeDiveIn,
  onEdgeEdit,
  onEdgeDelete,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { target, x, y } = menu;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
      style={{ left: x, top: y }}
      // Prevent ReactFlow from receiving right-click events on the menu itself
      onContextMenu={(e) => e.preventDefault()}
    >
      {target.kind === 'canvas' && (
        <>
          <MenuItem
            label="Add Node..."
            onClick={() => {
              // Placeholder: command palette wired in Task 14
              console.log('[ContextMenu] Add Node — deferred to Task 14');
              onClose();
            }}
          />
          <MenuItem
            label="Auto Layout"
            onClick={() => {
              // Placeholder: auto layout wired in Task 15
              console.log('[ContextMenu] Auto Layout — deferred to Task 15');
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            label="Fit View"
            onClick={() => {
              onCanvasFitView();
              onClose();
            }}
          />
        </>
      )}

      {target.kind === 'inlineNode' && (
        <>
          <MenuItem
            label="Edit Properties"
            onClick={() => {
              onNodeEditProperties(target.nodeId);
              onClose();
            }}
          />
          <MenuItem
            label="Add Note"
            onClick={() => {
              onNodeAddNote(target.nodeId);
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            label="Delete"
            danger
            onClick={() => {
              onNodeDelete(target.nodeId);
              onClose();
            }}
          />
        </>
      )}

      {target.kind === 'refNode' && (
        <>
          <MenuItem
            label="Dive In"
            onClick={() => {
              onRefNodeDiveIn(target.nodeId);
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            label="Delete"
            danger
            onClick={() => {
              onNodeDelete(target.nodeId);
              onClose();
            }}
          />
        </>
      )}

      {target.kind === 'edge' && (
        <>
          <MenuItem
            label="Edit"
            onClick={() => {
              onEdgeEdit(target.edgeData);
              onClose();
            }}
          />
          <MenuDivider />
          <MenuItem
            label="Delete"
            danger
            onClick={() => {
              onEdgeDelete(target.edgeData);
              onClose();
            }}
          />
        </>
      )}
    </div>
  );
}
