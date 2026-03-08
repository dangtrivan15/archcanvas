/**
 * UseTemplateDialog - prompts the user for a project name before
 * instantiating a template. Handles two import modes:
 *
 * 1. **Import as Container** (default when a project folder is open):
 *    Saves the template as a separate .archc file in the project folder and
 *    places a single container node on the current canvas with refSource
 *    pointing to the new file. Keeps the parent canvas clean and composable.
 *
 * 2. **Import Inline** (legacy / fallback):
 *    Dumps all template nodes directly onto the current canvas (replacing
 *    the existing graph). Used when no project folder is open or the user
 *    explicitly chooses inline mode.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Loader2, FolderOpen, Layers } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useProjectStore } from '@/store/projectStore';
import { instantiateStack, type StackTemplate } from '@/stacks/stackLoader';
import { computeElkLayout } from '@/core/layout/elkLayout';
import { parse as parseYaml } from 'yaml';
import type { TemplateRecord } from '@/templates/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { protoToGraph } from '@/core/storage/fileIO';
import { Architecture } from '@/proto/archcanvas';
import type { ArchGraph } from '@/types/graph';
import { createNode } from '@/core/graph/graphEngine';
import { addNode as engineAddNode } from '@/core/graph/graphEngine';

/** The two import modes available in the dialog. */
export type ImportMode = 'container' | 'inline';

interface UseTemplateDialogProps {
  /** The template record to instantiate, or null if dialog is closed */
  template: TemplateRecord | null;
  /** Called when the dialog should close (cancel or success) */
  onClose: () => void;
  /** Called after the template is successfully loaded */
  onSuccess?: () => void;
}

/**
 * Parse a TemplateRecord into an ArchGraph with a display name.
 * Handles both built-in (YAML) and imported (proto bytes) templates.
 */
function parseTemplateToGraph(template: TemplateRecord): {
  graph: ArchGraph;
  displayName: string;
} {
  if (typeof template.data === 'string') {
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
    return {
      graph: instantiateStack(stack),
      displayName: stack.metadata.displayName,
    };
  } else {
    const archProto = Architecture.decode(template.data);
    return {
      graph: protoToGraph({ architecture: archProto }),
      displayName: template.metadata.name,
    };
  }
}

export function UseTemplateDialog({ template, onClose, onSuccess }: UseTemplateDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('container');
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(!!template);

  const textApi = useCoreStore((s) => s.textApi);
  const undoManager = useCoreStore((s) => s.undoManager);
  const isDirty = useCoreStore((s) => s.isDirty);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const showToast = useUIStore((s) => s.showToast);
  const openUnsavedChangesDialog = useUIStore((s) => s.openUnsavedChangesDialog);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);

  const isProjectOpen = useProjectStore((s) => s.isProjectOpen);
  const saveTemplateAsFile = useProjectStore((s) => s.saveTemplateAsFile);

  // Pre-fill name and set default mode based on project state
  useEffect(() => {
    if (template) {
      setName(template.metadata.name);
      setLoading(false);
      setImportMode(isProjectOpen ? 'container' : 'inline');
      // Focus input after render
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [template, isProjectOpen]);

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

  /**
   * Import as Container: save template as .archc file in project folder,
   * then place a container node on the current canvas referencing it.
   */
  const doImportAsContainer = useCallback(
    async (archName: string) => {
      if (!template || !textApi || !undoManager) return;

      setLoading(true);
      try {
        // Parse template into a graph
        let graph: ArchGraph;
        let displayName: string;
        try {
          const result = parseTemplateToGraph(template);
          graph = result.graph;
          displayName = result.displayName;
        } catch (err) {
          console.error('[UseTemplate] Failed to parse template:', err);
          showToast('Failed to parse template data');
          setLoading(false);
          return;
        }

        // Override the architecture name
        graph.name = archName.trim() || displayName;

        // Apply ELK auto-layout to the template graph
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

        // Save as .archc file in the project folder
        const fileName = await saveTemplateAsFile(graph, archName.trim() || displayName);

        // Create a container node on the current canvas referencing the new file
        const containerNode = createNode({
          type: 'meta/canvas-ref',
          displayName: archName.trim() || displayName,
          args: {
            filePath: fileName,
            nodeCount: graph.nodes.length,
            description: graph.description || `Imported from template: ${template.metadata.name}`,
          },
        });
        containerNode.refSource = `file://./${fileName}`;

        // Add the container node to the current graph
        const currentGraph = textApi.getGraph();
        const updatedGraph = engineAddNode(currentGraph, containerNode);
        textApi.setGraph(updatedGraph);

        undoManager.snapshot('Import template as container: ' + archName, updatedGraph);

        useCoreStore.setState({
          graph: updatedGraph,
          isDirty: true,
          nodeCount: updatedGraph.nodes.length,
          edgeCount: updatedGraph.edges.length,
        });

        requestFitView();
        showToast(`Imported "${archName.trim() || displayName}" as container node`);
        onClose();
        onSuccess?.();
      } catch (err) {
        console.error('[UseTemplate] Failed to import as container:', err);
        showToast('Failed to import template as container');
      } finally {
        setLoading(false);
      }
    },
    [template, textApi, undoManager, saveTemplateAsFile, requestFitView, showToast, onClose, onSuccess],
  );

  /**
   * Import Inline: replace the current canvas with the template graph (legacy behavior).
   */
  const doImportInline = useCallback(
    async (archName: string) => {
      if (!template || !textApi || !undoManager) return;

      setLoading(true);
      try {
        let graph: ArchGraph;
        let displayName: string;
        try {
          const result = parseTemplateToGraph(template);
          graph = result.graph;
          displayName = result.displayName;
        } catch (err) {
          console.error('[UseTemplate] Failed to parse template:', err);
          showToast('Failed to load template');
          setLoading(false);
          return;
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

    const doAction = () => {
      if (importMode === 'container' && isProjectOpen) {
        doImportAsContainer(archName);
      } else {
        // Fall back to inline if no project is open
        if (importMode === 'container' && !isProjectOpen) {
          showToast('No project folder open — importing inline instead');
        }
        doImportInline(archName);
      }
    };

    if (isDirty && importMode === 'inline') {
      // Only show unsaved changes warning for inline mode (it replaces the graph)
      openUnsavedChangesDialog({ onConfirm: doAction });
    } else {
      doAction();
    }
  }, [
    name,
    template,
    isDirty,
    importMode,
    isProjectOpen,
    openUnsavedChangesDialog,
    doImportAsContainer,
    doImportInline,
    showToast,
  ]);

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

        {/* Import Mode Toggle */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
            Import Mode
          </label>
          <div className="flex gap-2" data-testid="import-mode-toggle">
            <button
              type="button"
              onClick={() => setImportMode('container')}
              disabled={loading}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm rounded-md border transition-colors ${
                importMode === 'container'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-blue-300'
              }`}
              data-testid="import-mode-container"
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">As Container</div>
                <div className="text-xs opacity-70">Save as file, add reference node</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setImportMode('inline')}
              disabled={loading}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm rounded-md border transition-colors ${
                importMode === 'inline'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-blue-300'
              }`}
              data-testid="import-mode-inline"
            >
              <Layers className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Inline</div>
                <div className="text-xs opacity-70">Add all nodes to canvas</div>
              </div>
            </button>
          </div>
          {importMode === 'container' && !isProjectOpen && (
            <p
              className="text-xs text-amber-600 dark:text-amber-400 mt-1.5"
              data-testid="no-project-warning"
            >
              No project folder is open. Container import will fall back to inline mode.
              Open a project folder first to use container import.
            </p>
          )}
        </div>

        {/* Name input */}
        <div className="mb-5">
          <label
            htmlFor="use-template-name"
            className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1.5"
          >
            {importMode === 'container' ? 'Container Name' : 'Architecture Name'}
          </label>
          <input
            ref={inputRef}
            id="use-template-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              importMode === 'container'
                ? 'Enter a name for the container node...'
                : 'Enter a name for your architecture...'
            }
            className="w-full px-3 py-2 text-sm rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            data-testid="use-template-name-input"
            disabled={loading}
            autoFocus
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            {importMode === 'container'
              ? 'The template will be saved as a separate .archc file in your project folder.'
              : 'A new architecture will be created with fresh node and edge IDs.'}
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
                {importMode === 'container' ? 'Importing...' : 'Creating...'}
              </>
            ) : importMode === 'container' ? (
              'Import as Container'
            ) : (
              'Use Template'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
