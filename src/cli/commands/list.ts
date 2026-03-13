import { useFileStore } from '@/store/fileStore';
import { resolveCanvasId } from '../context';
import { CLIError } from '../errors';
import type { OutputOptions } from '../output';
import { printSuccess } from '../output';
import type { Node, Edge, Entity } from '@/types';

export interface ListFlags {
  scope?: string;
  type: 'nodes' | 'edges' | 'entities' | 'all';
}

export function listCommand(flags: ListFlags, options: OutputOptions): void {
  const canvasId = resolveCanvasId(flags.scope);
  const canvas = useFileStore.getState().getCanvas(canvasId);

  if (!canvas) {
    throw new CLIError('CANVAS_NOT_FOUND', `Canvas '${canvasId}' not found.`);
  }

  const data = canvas.data;
  const nodes: Node[] = data.nodes ?? [];
  const edges: Edge[] = data.edges ?? [];
  const entities: Entity[] = data.entities ?? [];

  const result: Record<string, unknown> = {};

  if (flags.type === 'all' || flags.type === 'nodes') {
    result.nodes = nodes.map((n) => ({
      id: n.id,
      type: 'type' in n ? n.type : `ref:${'ref' in n ? n.ref : ''}`,
      displayName: 'displayName' in n ? n.displayName : undefined,
    }));
  }

  if (flags.type === 'all' || flags.type === 'edges') {
    result.edges = edges.map((e) => ({
      from: e.from.node,
      to: e.to.node,
      label: e.label,
      protocol: e.protocol,
    }));
  }

  if (flags.type === 'all' || flags.type === 'entities') {
    result.entities = entities.map((e) => ({
      name: e.name,
      description: e.description,
    }));
  }

  printSuccess(result, options);
}
