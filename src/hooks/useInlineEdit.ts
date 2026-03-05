/**
 * useInlineEdit - Reusable hook for inline node name editing.
 *
 * Extracts the inline editing state management that was duplicated across
 * all node components (GenericNode, HexagonNode, CloudNode, CylinderNode,
 * DocumentNode, ParallelogramNode, StadiumNode).
 *
 * Handles:
 * - Tracking edit value state
 * - Auto-focusing and selecting input text on activation
 * - Confirming edits via Enter/Tab/blur
 * - Reverting edits via Escape
 * - Committing name changes to the core store
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';

export interface UseInlineEditResult {
  /** Whether this node is currently in inline editing mode */
  isInlineEditing: boolean;
  /** Current edit value */
  editValue: string;
  /** Setter for edit value (for controlled input) */
  setEditValue: (value: string) => void;
  /** Ref to attach to the input element */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Confirm the edit and apply the new name */
  confirmEdit: () => void;
  /** Revert to the original name */
  revertEdit: () => void;
  /** Keyboard handler for Enter/Escape/Tab */
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Hook to manage inline node name editing.
 *
 * @param archNodeId - The node's architecture ID
 * @param displayName - The node's current display name
 */
export function useInlineEdit(archNodeId: string, displayName: string): UseInlineEditResult {
  const inlineEditNodeId = useUIStore((s) => s.inlineEditNodeId);
  const isInlineEditing = inlineEditNodeId === archNodeId;
  const [editValue, setEditValue] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  // When inline edit activates, focus the input and select all text
  useEffect(() => {
    if (isInlineEditing) {
      setEditValue(displayName);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [isInlineEditing, displayName]);

  /** Confirm inline edit: apply new display name via coreStore.updateNode() */
  const confirmEdit = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== displayName) {
      useCoreStore.getState().updateNode(archNodeId, {
        displayName: trimmedValue,
      });
    }
    useUIStore.getState().clearInlineEdit();
  }, [editValue, displayName, archNodeId]);

  /** Revert inline edit: discard changes */
  const revertEdit = useCallback(() => {
    setEditValue(displayName);
    useUIStore.getState().clearInlineEdit();
  }, [displayName]);

  /** Handle keyboard events on the inline edit input */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation(); // Prevent canvas shortcuts from firing
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        revertEdit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        confirmEdit();
      }
    },
    [confirmEdit, revertEdit],
  );

  return {
    isInlineEditing,
    editValue,
    setEditValue,
    inputRef,
    confirmEdit,
    revertEdit,
    handleKeyDown,
  };
}
