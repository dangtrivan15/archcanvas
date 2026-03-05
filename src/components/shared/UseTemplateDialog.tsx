/**
 * UseTemplateDialog - prompts the user for a project name before
 * instantiating a template. Handles:
 * 1. Name input (pre-filled with template name)
 * 2. Deep-clone of template Architecture with fresh ULIDs
 * 3. ELK auto-layout
 * 4. New ArchCanvasFile creation
 * 5. Unsaved changes warning
 * 6. Canvas loading and fit-view
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { instantiateStack, type StackTemplate } from '@/stacks/stackLoader';
import { computeElkLayout } from '@/core/layout/elkLayout';
import { parse as parseYaml } from 'yaml';
import type { TemplateRecord } from '@/templates/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { protoToGraph } from '@/core/storage/fileIO';
import { Architecture } from '@/proto/archcanvas';
import type { ArchGraph } from '@/types/graph';

interface UseTemplateDialogProps {
  /** The template record to instantiate, or null if dialog is closed */
  template: TemplateRecord | null;
  /** Called when the dialog should close (cancel or success) */
  onClose: () => void;
  /** Called after the template is successfully loaded */
  onSuccess?: () => void;
}

export function UseTemplateDialog({ template, onClose, onSuccess }: UseTemplateDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(!!template);

  const textApi = useCoreStore((s) => s.textApi);
  const undoManager = useCoreStore((s) => s.undoManager);
  const isDirty = useCoreStore((s) => s.isDirty);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const showToast = useUIStore((s) => s.showToast);
  const openUnsavedChangesDialog = useUIStore((s) => s.openUnsavedChangesDialog);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);

  // Pre-fill name when template changes
  useEffect(() => {
    if (template) {
      setName(template.metadata.name);
      setLoading(false);
      // Focus input after render
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [template]);

  // Escape to close
  useEffect(() => {
    if (!template) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [template, onClose]);

  const doInstantiate = useCallback(
    async (archName: string) => {
      if (!template || !textApi || !undoManager) return;

      setLoading(true);
      try {
        // Parse template into an ArchGraph
        let graph: ArchGraph;
        let displayName: string;

        if (typeof template.data === 'string') {
          // Built-in: raw YAML string
          const parsed = parseYaml(template.data) as {
            metadata: StackTemplate['metadata'];
            nodes: StackTemplate['nodes'];
            edges: StackTemplate['edges'];
          };
          const stack: StackTemplate = {
            metadata: parsed.metadata,
            nodes: parsed.nodes || [],
            edges: parsed.edges || [],
          };
          graph = instantiateStack(stack);
          displayName = stack.metadata.displayName;
        } else {
          // Imported: Architecture proto bytes
          try {
            const archProto = Architecture.decode(template.data);
            graph = protoToGraph({ architecture: archProto });
            displayName = template.metadata.name;
          } catch (err) {
            console.error('[UseTemplate] Failed to decode imported template:', err);
            showToast('Failed to load imported template');
            setLoading(false);
            return;
          }
        }

        // Override the architecture name with user-provided name
        graph.name = archName.trim() || displayName;

        // Apply ELK auto-layout
        try {
          const layoutResult = await computeElkLayout(graph.nodes, graph.edges, 'horizontal');
          for (const node of graph.nodes) {
            const pos = layoutResult.positions.get(node.id);
            if (pos) {
              node.position = { ...node.position, x: pos.x, y: pos.y };
            }
          }
        } catch (err) {
          console.warn('[UseTemplate] ELK layout failed, using template positions:', err);
        }

        // Load graph onto canvas
        textApi.setGraph(graph);
        undoManager.clear();
        undoManager.snapshot('Use template: ' + archName, graph);

        useCoreStore.setState({
          graph,
          isDirty: true,
          fileName: archName.trim() || displayName,
          fileHandle: null,
          fileCreatedAtMs: null,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          canUndo: false,
          canRedo: false,
        });

        zoomToRoot();
        requestFitView();
        showToast(`Created "${archName.trim() || displayName}" from template`);
        onClose();
        onSuccess?.();
      } catch (err) {
        console.error('[UseTemplate] Failed to instantiate template:', err);
        showToast('Failed to create architecture from template');
      } finally {
        setLoading(false);
      }
    },
    [template, textApi, undoManager, zoomToRoot, requestFitView, showToast, onClose, onSuccess],
  );

  const handleConfirm = useCallback(() => {
    const archName = name.trim() || template?.metadata.name || 'Untitled';

    if (isDirty) {
      // Show unsaved changes warning first
      openUnsavedChangesDialog({
        onConfirm: () => {
          doInstantiate(archName);
        },
      });
    } else {
      doInstantiate(archName);
    }
  }, [name, template, isDirty, openUnsavedChangesDialog, doInstantiate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleConfirm();
    }
  };

  if (!template) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="use-template-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        ref={focusTrapRef}
        className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg shadow-xl w-[440px] max-w-[95vw] p-6"
        data-testid="use-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="use-template-title"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2
              id="use-template-title"
              className="text-lg font-semibold text-[hsl(var(--foreground))]"
            >
              Use Template
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {template.metadata.name} - {template.metadata.nodeCount} nodes,{' '}
              {template.metadata.edgeCount} edges
            </p>
          </div>
        </div>

        {/* Name input */}
        <div className="mb-5">
          <label
            htmlFor="use-template-name"
            className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1.5"
          >
            Architecture Name
          </label>
          <input
            ref={inputRef}
            id="use-template-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a name for your architecture..."
            className="w-full px-3 py-2 text-sm rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            data-testid="use-template-name-input"
            disabled={loading}
            autoFocus
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            A new architecture will be created with fresh node and edge IDs.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md hover:bg-[hsl(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-50"
            data-testid="use-template-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
            data-testid="use-template-confirm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Use Template'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
