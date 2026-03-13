import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { resolveCanvasId } from '../context';
import { CLIError } from '../errors';
import type { OutputOptions } from '../output';
import { printSuccess } from '../output';
import type { CLIContext } from '../context';
import type { Node, Edge, Entity } from '@/types';

export interface ImportFlags {
  file: string;
  scope?: string;
}

interface ImportError {
  type: 'node' | 'edge' | 'entity';
  item: unknown;
  error: string;
}

export async function importCommand(
  flags: ImportFlags,
  options: OutputOptions,
  ctx: CLIContext,
): Promise<void> {
  const canvasId = resolveCanvasId(flags.scope);

  // Verify the canvas exists
  const canvas = useFileStore.getState().getCanvas(canvasId);
  if (!canvas) {
    throw new CLIError('CANVAS_NOT_FOUND', `Canvas '${canvasId}' not found.`);
  }

  // Read and parse the YAML file
  const filePath = resolve(flags.file);
  let fileContent: string;
  try {
    fileContent = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new CLIError(
      'INVALID_ARGS',
      `Cannot read file '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseYaml(fileContent) as Record<string, unknown>;
  } catch (err) {
    throw new CLIError(
      'INVALID_ARGS',
      `Invalid YAML in '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new CLIError('INVALID_ARGS', `YAML file must contain an object with nodes/edges/entities arrays.`);
  }

  const nodes = (parsed.nodes as Node[] | undefined) ?? [];
  const edges = (parsed.edges as Edge[] | undefined) ?? [];
  const entities = (parsed.entities as Entity[] | undefined) ?? [];

  const added = { nodes: 0, edges: 0, entities: 0 };
  const errors: ImportError[] = [];
  const graphStore = useGraphStore.getState();

  // Import nodes
  for (const node of nodes) {
    const result = graphStore.addNode(canvasId, node);
    if (result.ok) {
      added.nodes++;
    } else {
      errors.push({
        type: 'node',
        item: node,
        error: `${result.error.code}: ${'nodeId' in result.error ? result.error.nodeId : ''}`,
      });
    }
  }

  // Import edges
  for (const edge of edges) {
    const result = graphStore.addEdge(canvasId, edge);
    if (result.ok) {
      added.edges++;
    } else {
      errors.push({
        type: 'edge',
        item: edge,
        error: `${result.error.code}`,
      });
    }
  }

  // Import entities
  for (const entity of entities) {
    const result = graphStore.addEntity(canvasId, entity);
    if (result.ok) {
      added.entities++;
    } else {
      errors.push({
        type: 'entity',
        item: entity,
        error: `${result.error.code}: ${'name' in result.error ? result.error.name : ''}`,
      });
    }
  }

  // Save once at end (C11.1, C5i.4)
  await useFileStore.getState().saveAll(ctx.fs);

  printSuccess({ added, errors }, options);
}
