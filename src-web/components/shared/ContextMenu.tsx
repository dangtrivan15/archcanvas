import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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
  onCanvasExportPng?: () => void;
  onNodeEditProperties: (nodeId: string) => void;
  onNodeAddNote: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onRefNodeDiveIn: (nodeId: string) => void;
  onRefNodeFitContent?: (nodeId: string) => void;
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
    <motion.button
      className={`w-full text-left px-3 py-1.5 text-sm rounded transition-colors hover:bg-accent ${
        danger ? 'text-destructive hover:bg-destructive/20' : 'text-popover-foreground'
      }`}
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      onMouseDown={(e) => {
        // Use onMouseDown + preventDefault so the click doesn't propagate
        // to the canvas before we execute the action.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {label}
    </motion.button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-border" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContextMenu({
  menu,
  onClose,
  onCanvasFitView,
  onCanvasExportPng,
  onNodeEditProperties,
  onNodeAddNote,
  onNodeDelete,
  onRefNodeDiveIn,
  onRefNodeFitContent,
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
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg"
      style={{ left: x, top: y, transformOrigin: '0 0' }}
      initial={prefersReduced ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      // Prevent ReactFlow from receiving right-click events on the menu itself
      onContextMenu={(e) => e.preventDefault()}
    >
      {target.kind === 'canvas' && (
        <>
          <MenuItem
            label="Add Node..."
            onClick={() => {
              window.dispatchEvent(new CustomEvent('archcanvas:open-palette'));
              onClose();
            }}
          />
          <MenuItem
            label="Create Subsystem..."
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('archcanvas:open-palette', { detail: { mode: 'subsystem' } }),
              );
              onClose();
            }}
          />
          <MenuItem
            label="Auto Layout"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('archcanvas:auto-layout'));
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
          {onCanvasExportPng && (
            <>
              <MenuDivider />
              <MenuItem
                label="Export as PNG"
                onClick={() => {
                  onCanvasExportPng();
                  onClose();
                }}
              />
            </>
          )}
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
          {target.nodeData.node.position?.autoSize === false && onRefNodeFitContent && (
            <MenuItem
              label="Fit to content"
              onClick={() => {
                onRefNodeFitContent(target.nodeId);
                onClose();
              }}
            />
          )}
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
    </motion.div>
  );
}
