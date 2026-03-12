import { ScrollArea } from '@/components/ui/scroll-area';
import { useCanvasStore } from '@/store/canvasStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useNavigationStore } from '@/store/navigationStore';
import type { InlineNode } from '@/types';
import { NodeDetailPanel } from '@/components/panels/NodeDetailPanel';
import { EdgeDetailPanel } from '@/components/panels/EdgeDetailPanel';

function isInlineNode(node: { id: string; ref?: string; type?: string }): node is InlineNode {
  return 'type' in node && node.ref === undefined;
}

export function RightPanel() {
  const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeKeys = useCanvasStore((s) => s.selectedEdgeKeys);
  const canvas = useFileStore((s) => s.getCanvas(currentCanvasId));
  const resolve = useRegistryStore((s) => s.resolve);

  const allNodes = canvas?.data.nodes ?? [];

  // Collect selected InlineNodes (RefNodes are not editable in the detail panel)
  const selectedInlineNodes = [...selectedNodeIds]
    .map((id) => allNodes.find((n) => n.id === id))
    .filter((n): n is InlineNode => n !== undefined && isInlineNode(n));

  const totalSelected = selectedNodeIds.size + selectedEdgeKeys.size;

  let content: React.ReactNode;

  if (totalSelected === 0) {
    content = (
      <div className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground">Detail Panel</h3>
        <p className="mt-2 text-xs text-muted-foreground">Select a node to view its properties.</p>
      </div>
    );
  } else if (selectedEdgeKeys.size === 1 && selectedNodeIds.size === 0) {
    // Single edge selected — resolve edge from canvas data
    const edgeKey = [...selectedEdgeKeys][0];
    const [fromNode, toNode] = edgeKey.split('→');
    const allEdges = canvas?.data.edges ?? [];
    const edge = allEdges.find((e) => e.from.node === fromNode && e.to.node === toNode);
    if (edge) {
      content = <EdgeDetailPanel edge={edge} canvasId={currentCanvasId} />;
    } else {
      content = (
        <div className="p-4">
          <p className="text-xs text-muted-foreground">Edge not found.</p>
        </div>
      );
    }
  } else if (selectedEdgeKeys.size > 1 && selectedNodeIds.size === 0) {
    const count = selectedEdgeKeys.size;
    content = (
      <div className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground">{count} Edges Selected</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Select a single edge to view its properties.
        </p>
      </div>
    );
  } else if (totalSelected > 1) {
    content = (
      <div className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {totalSelected} items selected
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Select a single node to view its properties.
        </p>
      </div>
    );
  } else if (selectedInlineNodes.length === 1) {
    const node = selectedInlineNodes[0];
    const nodeDef = resolve(node.type);
    content = (
      <NodeDetailPanel node={node} nodeDef={nodeDef} canvasId={currentCanvasId} />
    );
  } else {
    // Single RefNode selected — no inline editing
    content = (
      <div className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground">Reference Node</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          This node references another canvas. Double-click to dive in.
        </p>
      </div>
    );
  }

  return <ScrollArea className="h-full">{content}</ScrollArea>;
}
