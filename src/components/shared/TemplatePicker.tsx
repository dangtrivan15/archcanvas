/**
 * Template Picker Dialog - lets users choose a predefined stack template
 * to instantiate as a new architecture.
 */

import { useState } from 'react';
import { X, Rocket, Layers, ArrowRight, MessageSquare, MessageCircle, Brain, Smartphone, Zap, BarChart3, Network } from 'lucide-react';
import { getAvailableStacks, instantiateStack, type StackTemplate } from '@/stacks/stackLoader';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';

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
};

export function TemplatePicker() {
  const templatePickerOpen = useUIStore((s) => s.templatePickerOpen);
  const closeTemplatePicker = useUIStore((s) => s.closeTemplatePicker);

  if (!templatePickerOpen) return null;

  return <TemplatePickerContent onClose={closeTemplatePicker} />;
}

function TemplatePickerContent({ onClose }: { onClose: () => void }) {
  const [selectedStack, setSelectedStack] = useState<StackTemplate | null>(null);
  const stacks = getAvailableStacks();
  const _setGraph = useCoreStore((s) => s._setGraph);
  const textApi = useCoreStore((s) => s.textApi);
  const undoManager = useCoreStore((s) => s.undoManager);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const showToast = useUIStore((s) => s.showToast);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);

  const handleInstantiate = (template: StackTemplate) => {
    if (!textApi || !undoManager) return;

    const graph = instantiateStack(template);

    // Apply the instantiated graph
    textApi.setGraph(graph);
    undoManager.clear();
    undoManager.snapshot('Load stack template', graph);

    useCoreStore.setState({
      graph,
      isDirty: true,
      fileName: template.metadata.displayName,
      fileHandle: null,
      fileCreatedAtMs: null,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      canUndo: false,
      canRedo: false,
    });

    // Reset navigation and fit view
    zoomToRoot();
    requestFitView();

    showToast(`Loaded "${template.metadata.displayName}" template`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="template-picker-overlay">
      <div
        className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg shadow-xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col"
        data-testid="template-picker-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            New from Template
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Close template picker"
            data-testid="template-picker-close"
          >
            <X className="w-5 h-5" />
          </button>
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
            onClick={() => selectedStack && handleInstantiate(selectedStack)}
            disabled={!selectedStack}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
              selectedStack
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            data-testid="template-picker-create"
          >
            <Rocket className="w-4 h-4" />
            Create from Template
          </button>
        </div>
      </div>
    </div>
  );
}
