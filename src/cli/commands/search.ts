import { useFileStore } from '@/store/fileStore';
import type { OutputOptions } from '../output';
import { printSuccess } from '../output';
import type { Node, Edge, Entity } from '@/types';

export interface SearchFlags {
  type?: 'nodes' | 'edges' | 'entities' | 'all';
}

interface SearchResultItem {
  type: 'node' | 'edge' | 'entity';
  scope: string;
  item: Record<string, unknown>;
}

export function searchCommand(
  query: string,
  flags: SearchFlags,
  options: OutputOptions,
): void {
  const project = useFileStore.getState().project;
  if (!project) {
    printSuccess({ results: [] }, options);
    return;
  }

  const q = query.toLowerCase();
  const typeFilter = flags.type ?? 'all';
  const results: SearchResultItem[] = [];

  for (const [canvasId, canvas] of project.canvases) {
    const data = canvas.data;

    // Search nodes
    if (typeFilter === 'all' || typeFilter === 'nodes') {
      for (const node of data.nodes ?? []) {
        if (matchesNode(node, q)) {
          results.push({
            type: 'node',
            scope: canvasId,
            item: {
              id: node.id,
              type: 'type' in node ? node.type : `ref:${'ref' in node ? node.ref : ''}`,
              displayName: 'displayName' in node ? node.displayName : undefined,
            },
          });
        }
      }
    }

    // Search edges
    if (typeFilter === 'all' || typeFilter === 'edges') {
      for (const edge of data.edges ?? []) {
        if (matchesEdge(edge, q)) {
          results.push({
            type: 'edge',
            scope: canvasId,
            item: {
              from: edge.from.node,
              to: edge.to.node,
              label: edge.label,
              protocol: edge.protocol,
            },
          });
        }
      }
    }

    // Search entities
    if (typeFilter === 'all' || typeFilter === 'entities') {
      for (const entity of data.entities ?? []) {
        if (matchesEntity(entity, q)) {
          results.push({
            type: 'entity',
            scope: canvasId,
            item: {
              name: entity.name,
              description: entity.description,
            },
          });
        }
      }
    }
  }

  printSuccess({ results }, options);
}

function matchesNode(node: Node, query: string): boolean {
  const fields: (string | undefined)[] = [
    node.id,
    'displayName' in node ? node.displayName : undefined,
    'type' in node ? node.type : undefined,
  ];
  return fields.some((f) => f?.toLowerCase().includes(query));
}

function matchesEdge(edge: Edge, query: string): boolean {
  const fields: (string | undefined)[] = [
    edge.label,
    edge.from.node,
    edge.to.node,
  ];
  return fields.some((f) => f?.toLowerCase().includes(query));
}

function matchesEntity(entity: Entity, query: string): boolean {
  const fields: (string | undefined)[] = [
    entity.name,
    entity.description,
  ];
  return fields.some((f) => f?.toLowerCase().includes(query));
}
