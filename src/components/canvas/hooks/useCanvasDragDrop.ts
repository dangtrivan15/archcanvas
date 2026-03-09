/**
 * useCanvasDragDrop - Handles drag-and-drop onto the canvas.
 * Supports: NodeDef palette drag, .archc file drops, and image drops.
 */

import { useCallback, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';

export function useCanvasDragDrop() {
  const addNode = useCoreStore((s) => s.addNode);
  const loadFromDroppedFile = useCoreStore((s) => s.loadFromDroppedFile);
  const showToast = useUIStore((s) => s.showToast);
  const { screenToFlowPosition } = useReactFlow();

  const [isDragOverWithFiles, setIsDragOverWithFiles] = useState(false);
  const dragOverCounterRef = useRef(0);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (event.dataTransfer.types.includes('Files')) {
      setIsDragOverWithFiles(true);
    }
  }, []);

  const onCanvasDragEnter = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('Files')) {
      dragOverCounterRef.current += 1;
      if (dragOverCounterRef.current === 1) {
        setIsDragOverWithFiles(true);
      }
    }
  }, []);

  const onCanvasDragLeave = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('Files')) {
      dragOverCounterRef.current -= 1;
      if (dragOverCounterRef.current <= 0) {
        dragOverCounterRef.current = 0;
        setIsDragOverWithFiles(false);
      }
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOverWithFiles(false);
      dragOverCounterRef.current = 0;

      // 1. Handle NodeDefBrowser drops
      const nodeDefData = event.dataTransfer.getData('application/archcanvas-nodedef');
      if (nodeDefData) {
        try {
          const { nodeType, displayName } = JSON.parse(nodeDefData);
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          addNode({
            type: nodeType,
            displayName,
            position: { x: position.x, y: position.y },
          });
        } catch {
          console.warn('[Canvas] Invalid drop data');
        }
        return;
      }

      // 2. Handle file drops (from Files app, desktop, etc.)
      const files = event.dataTransfer.files;
      if (files.length === 0) return;

      // Check for multiple files
      if (files.length > 1) {
        const archcFiles: File[] = [];
        const imageFiles: File[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i]!;
          if (f.name.toLowerCase().endsWith('.archc')) {
            archcFiles.push(f);
          } else if (f.type.startsWith('image/')) {
            imageFiles.push(f);
          }
        }

        if (archcFiles.length > 1) {
          showToast('Only one .archc file can be opened at a time. Please drop a single file.');
          return;
        }
        if (archcFiles.length === 1) {
          loadFromDroppedFile(archcFiles[0]!);
          return;
        }
        if (imageFiles.length > 0) {
          showToast(
            `${imageFiles.length} image(s) noted — image attachment to nodes is not yet available.`,
          );
          return;
        }
        showToast(
          'Unsupported file type. Drop .archc files to open an architecture, or images to attach.',
        );
        return;
      }

      // Single file drop
      const file = files[0]!;
      if (file.name.toLowerCase().endsWith('.archc')) {
        loadFromDroppedFile(file);
        return;
      }
      if (file.type.startsWith('image/')) {
        showToast('Image dropped — image attachment to nodes is not yet available.');
        return;
      }
      showToast(`Unsupported file type: "${file.name}". Only .archc files can be opened.`);
    },
    [screenToFlowPosition, addNode, loadFromDroppedFile, showToast],
  );

  return {
    isDragOverWithFiles,
    onDragOver,
    onCanvasDragEnter,
    onCanvasDragLeave,
    onDrop,
  };
}
