import type { Canvas, Node, Edge, Entity } from '@/types';
import type { LoadedCanvas } from '@/storage/fileResolver';
import type { SearchResult } from './types';

// --- Single-Canvas Queries ---

export function findNode(canvas: Canvas, nodeId: string): Node | undefined {
  return (canvas.nodes ?? []).find((n) => n.id === nodeId);
}

export function findEdge(
  canvas: Canvas,
  fromNode: string,
  toNode: string,
): Edge | undefined {
  return (canvas.edges ?? []).find(
    (e) => e.from.node === fromNode && e.to.node === toNode,
  );
}

export function listNodes(canvas: Canvas): Node[] {
  return canvas.nodes ?? [];
}

export function listEdges(canvas: Canvas): Edge[] {
  return canvas.edges ?? [];
}

export function listEntities(canvas: Canvas): Entity[] {
  return canvas.entities ?? [];
}

// --- Cross-Scope Queries ---

export function findNodeAcrossScopes(
  canvases: Map<string, LoadedCanvas>,
  nodeId: string,
): { canvasId: string; node: Node } | undefined {
  for (const [canvasId, loaded] of canvases) {
    const node = (loaded.data.nodes ?? []).find((n) => n.id === nodeId);
    if (node) return { canvasId, node };
  }
  return undefined;
}

export function findEdgesReferencingNode(
  canvases: Map<string, LoadedCanvas>,
  nodeId: string,
): Array<{ canvasId: string; edge: Edge }> {
  const results: Array<{ canvasId: string; edge: Edge }> = [];

  for (const [canvasId, loaded] of canvases) {
    for (const edge of loaded.data.edges ?? []) {
      if (matchesNodeId(edge.from.node, nodeId) || matchesNodeId(edge.to.node, nodeId)) {
        results.push({ canvasId, edge });
      }
    }
  }

  return results;
}

function matchesNodeId(endpoint: string, nodeId: string): boolean {
  if (endpoint === nodeId) return true;
  if (endpoint.startsWith('@root/') && endpoint.slice('@root/'.length) === nodeId) return true;
  return false;
}

export function findEdgesReferencingEntity(
  canvases: Map<string, LoadedCanvas>,
  entityName: string,
): Array<{ canvasId: string; edge: Edge }> {
  const results: Array<{ canvasId: string; edge: Edge }> = [];

  for (const [canvasId, loaded] of canvases) {
    for (const edge of loaded.data.edges ?? []) {
      if ((edge.entities ?? []).includes(entityName)) {
        results.push({ canvasId, edge });
      }
    }
  }

  return results;
}

export function findRefsToSubsystem(
  canvases: Map<string, LoadedCanvas>,
  ref: string,
): Array<{ canvasId: string; nodeId: string }> {
  const results: Array<{ canvasId: string; nodeId: string }> = [];

  for (const [canvasId, loaded] of canvases) {
    for (const node of loaded.data.nodes ?? []) {
      if ('ref' in node && node.ref === ref) {
        results.push({ canvasId, nodeId: node.id });
      }
    }
  }

  return results;
}

// --- Search ---

export function searchGraph(
  canvases: Map<string, LoadedCanvas>,
  query: string,
): SearchResult[] {
  if (query === '') return [];

  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const [canvasId, loaded] of canvases) {
    const canvas = loaded.data;

    // Search nodes
    for (const node of canvas.nodes ?? []) {
      const isInline = !('ref' in node);
      let score = 0;
      let bestContext = '';
      let bestScore = 0;

      if (isInline) {
        // displayName: 20 points
        if (node.displayName && matches(node.displayName, q)) {
          score += 20;
          if (20 > bestScore) { bestScore = 20; bestContext = node.displayName; }
        }

        // type: 10 points
        if (node.type && matches(node.type, q)) {
          score += 10;
          if (10 > bestScore) { bestScore = 10; bestContext = node.type; }
        }

        // description: 5 points
        if (node.description && matches(node.description, q)) {
          score += 5;
          if (5 > bestScore) { bestScore = 5; bestContext = node.description; }
        }

        // args values: 5 points each
        if (node.args) {
          for (const value of Object.values(node.args)) {
            const strVal = String(value);
            if (matches(strVal, q)) {
              score += 5;
              if (5 > bestScore) { bestScore = 5; bestContext = strVal; }
            }
          }
        }
      } else {
        // RefNode — only id is searchable (no displayName/type/args/description)
        // RefNodes don't contribute to search results via type/args/description
      }

      if (score > 0) {
        const displayName = isInline
          ? (node.displayName ?? node.id)
          : node.id;
        results.push({
          type: 'node',
          canvasId,
          nodeId: node.id,
          displayName,
          matchContext: bestContext,
          score,
        });
      }
    }

    // Search edges
    for (const edge of canvas.edges ?? []) {
      let score = 0;
      let bestContext = '';
      let bestScore = 0;

      // label: 10 points
      if (edge.label && matches(edge.label, q)) {
        score += 10;
        if (10 > bestScore) { bestScore = 10; bestContext = edge.label; }
      }

      // protocol: 5 points
      if (edge.protocol && matches(edge.protocol, q)) {
        score += 5;
        if (5 > bestScore) { bestScore = 5; bestContext = edge.protocol; }
      }

      if (score > 0) {
        results.push({
          type: 'edge',
          canvasId,
          from: edge.from.node,
          to: edge.to.node,
          displayName: edge.label ?? `${edge.from.node} → ${edge.to.node}`,
          matchContext: bestContext,
          score,
        });
      }
    }

    // Search entities
    for (const entity of canvas.entities ?? []) {
      let score = 0;
      let bestContext = '';
      let bestScore = 0;

      // name: 15 points
      if (matches(entity.name, q)) {
        score += 15;
        if (15 > bestScore) { bestScore = 15; bestContext = entity.name; }
      }

      // description: 5 points
      if (entity.description && matches(entity.description, q)) {
        score += 5;
        if (5 > bestScore) { bestScore = 5; bestContext = entity.description; }
      }

      if (score > 0) {
        results.push({
          type: 'entity',
          canvasId,
          name: entity.name,
          displayName: entity.name,
          matchContext: bestContext,
          score,
        });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

function matches(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}
