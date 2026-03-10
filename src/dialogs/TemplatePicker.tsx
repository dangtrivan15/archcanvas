/**
 * Template Picker Dialog - lets users choose a predefined stack template
 * to instantiate as a new architecture. Supports two import modes:
 * - "Import as Container" (default when project folder is open)
 * - "Import Inline" (legacy, replaces current canvas)
 */

import { useState, useCallback } from 'react';
import {
  X,
  Rocket,
  Layers,
  ArrowRight,
  MessageSquare,
  MessageCircle,
  Brain,
  Smartphone,
  Zap,
  BarChart3,
  Network,
  HeartPulse,
  Users,
  Wrench,
  ShoppingCart,
  Landmark,
  Radio,
  FolderOpen,
} from 'lucide-react';
import { getAvailableStacks, instantiateStack, type StackTemplate } from '@/stacks/stackLoader';
import { useEngineStore } from '@/store/engineStore';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useHistoryStore } from '@/store/historyStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useProjectStore } from '@/store/projectStore';
import { computeElkLayout } from '@/core/layout/elkLayout';
import { createNode, addNode as engineAddNode } from '@/core/graph/graphEngine';
import type { ImportMode } from '@/components/shared/UseTemplateDialog';
import { registerDialog } from './registry';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Layers,
  MessageSquare,
  MessageCircle,
  Brain,
  Smartphone,
  Zap,
  BarChart3,
  Network,
  HeartPulse,
  Users,
  Wrench,
  ShoppingCart,
  Landmark,
  Radio,
};

export function TemplatePicker() {
  const templatePickerOpen = useUIStore((s) => s.templatePickerOpen);
  const closeTemplatePicker = useUIStore((s) => s.closeTemplatePicker);

  if (!templatePickerOpen) return null;

  return <TemplatePickerContent onClose={closeTemplatePicker} />;
}

function TemplatePickerContent({ onClose }: { onClose: () => void }) {
  const [selectedStack, setSelectedStack] = useState<StackTemplate | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('container');
  const stacks = getAvailableStacks();
  const textApi = useEngineStore((s) => s.textApi);
  const undoManager = useEngineStore((s) => s.undoManager);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const showToast = useUIStore((s) => s.showToast);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);

  const isProjectOpen = useProjectStore((s) => s.isProjectOpen);
  const saveTemplateAsFile = useProjectStore((s) => s.saveTemplateAsFile);

  const handleInstantiateInline = useCallback(
    (template: StackTemplate) => {
      if (!textApi || !undoManager) return;

      const graph = instantiateStack(template);

      // Apply the instantiated graph
      textApi.setGraph(graph);
      undoManager.clear();
      undoManager.snapshot('Load stack template', graph);

      useGraphStore.setState({
        graph,
        isDirty: true,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      });
      useFileStore.setState({
        fileName: template.metadata.displayName,
        fileHandle: null,
        fileCreatedAtMs: null,
      });
      useHistoryStore.setState({
        canUndo: false,
        canRedo: false,
      });

      // Reset navigation and fit view
      zoomToRoot();
      requestFitView();

      showToast(`Loaded "${template.metadata.displayName}" template`);
      onClose();
    },
    [textApi, undoManager, zoomToRoot, requestFitView, showToast, onClose],
  );

  const handleInstantiateAsContainer = useCallback(
    async (template: StackTemplate) => {
      if (!textApi || !undoManager) return;

      const graph = instantiateStack(template);
      const displayName = template.metadata.displayName;

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
        console.warn('[TemplatePicker] ELK layout failed, using template positions:', err);
      }

      // Create the container node FIRST to obtain its ULID
      const containerNode = createNode({
        type: 'meta/canvas-ref',
        displayName,
        args: {
          nodeCount: graph.nodes.length,
          description: template.metadata.description,
        },
      });

      // Save as .archc file named after the container node's ID
      const fileName = await saveTemplateAsFile(graph, displayName, containerNode.id);

      // Set refSource to bare filename and update filePath arg
      containerNode.refSource = fileName;
      containerNode.args = { ...containerNode.args, filePath: fileName };

      const currentGraph = textApi.getGraph();
      const updatedGraph = engineAddNode(currentGraph, containerNode);
      textApi.setGraph(updatedGraph);

      undoManager.snapshot('Import template as container: ' + displayName, updatedGraph);

      useGraphStore.setState({
        graph: updatedGraph,
        isDirty: true,
        nodeCount: updatedGraph.nodes.length,
        edgeCount: updatedGraph.edges.length,
      });

      requestFitView();
      showToast(`Imported "${displayName}" as container node`);
      onClose();
    },
    [textApi, undoManager, saveTemplateAsFile, requestFitView, showToast, onClose],
  );

  const handleCreate = useCallback(() => {
    if (!selectedStack) return;

    if (importMode === 'container' && isProjectOpen) {
      handleInstantiateAsContainer(selectedStack);
    } else {
      if (importMode === 'container' && !isProjectOpen) {
        showToast('No project folder open — importing inline instead');
      }
      handleInstantiateInline(selectedStack);
    }
  }, [
    selectedStack,
    importMode,
    isProjectOpen,
    handleInstantiateAsContainer,
    handleInstantiateInline,
    showToast,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="template-picker-overlay"
    >
      <div
        className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg shadow-xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col"
        data-testid="template-picker-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">New from Template</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Close template picker"
            data-testid="template-picker-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import Mode Toggle */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex gap-2" data-testid="picker-import-mode-toggle">
            <button
              type="button"
              onClick={() => setImportMode('container')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                importMode === 'container'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-blue-300'
              }`}
              data-testid="picker-mode-container"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              As Container
            </button>
            <button
              type="button"
              onClick={() => setImportMode('inline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                importMode === 'inline'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-blue-300'
              }`}
              data-testid="picker-mode-inline"
            >
              <Layers className="w-3.5 h-3.5" />
              Inline
            </button>
          </div>
          {importMode === 'container' && !isProjectOpen && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              No project folder open. Will fall back to inline import.
            </p>
          )}
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {stacks.map((stack) => {
            const IconComponent = ICON_MAP[stack.metadata.icon] || Rocket;
            const isSelected = selectedStack?.metadata.name === stack.metadata.name;

            return (
              <button
                key={stack.metadata.name}
                onClick={() => setSelectedStack(stack)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-[hsl(var(--border))] hover:border-blue-300 hover:bg-[hsl(var(--muted)/0.5)]'
                }`}
                data-testid={`template-card-${stack.metadata.name}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                    <IconComponent className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[hsl(var(--foreground))]">
                      {stack.metadata.displayName}
                    </div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                      {stack.metadata.description}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {stack.nodes.length} nodes
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        {stack.edges.length} edges
                      </span>
                      {stack.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Node preview list when selected */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                    <div className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">
                      Included Components
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {stack.nodes.map((node) => (
                        <div
                          key={node.id}
                          className="text-xs flex items-center gap-1.5 text-[hsl(var(--foreground))]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span className="truncate">{node.displayName}</span>
                          <span className="text-[hsl(var(--muted-foreground))] font-mono ml-auto shrink-0">
                            {node.type}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5 mt-3 uppercase tracking-wider">
                      Connections
                    </div>
                    <div className="space-y-1">
                      {stack.edges.map((edge, i) => (
                        <div
                          key={i}
                          className="text-xs flex items-center gap-1 text-[hsl(var(--foreground))]"
                        >
                          <span className="truncate">
                            {stack.nodes.find((n) => n.id === edge.fromNode)?.displayName}
                          </span>
                          <ArrowRight className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                          <span className="truncate">
                            {stack.nodes.find((n) => n.id === edge.toNode)?.displayName}
                          </span>
                          <span className="ml-auto text-[hsl(var(--muted-foreground))] uppercase text-[10px] shrink-0">
                            {edge.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer with action buttons */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[hsl(var(--border))]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md hover:bg-[hsl(var(--muted))] transition-colors"
            data-testid="template-picker-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedStack}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
              selectedStack
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            data-testid="template-picker-create"
          >
            {importMode === 'container' && isProjectOpen ? (
              <>
                <FolderOpen className="w-4 h-4" />
                Import as Container
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Create from Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Self-registration ────────────────────────────────────────────────────────
registerDialog({ id: 'template-picker', component: TemplatePicker });
