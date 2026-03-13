import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { loadContext, resolveCanvasId, bridgeMutate } from '../context';
import { CLIError, engineErrorMessage } from '../errors';
import { printSuccess, type OutputOptions } from '../output';
import type { InlineNode } from '@/types/schema';

export interface AddNodeOptions {
  id: string;
  type: string;
  name?: string;
  scope?: string;
  args?: string;
  project?: string;
}

export async function addNodeCommand(
  options: AddNodeOptions,
  globalOptions: OutputOptions,
): Promise<void> {
  const ctx = await loadContext(options.project);

  // Validate --type exists in registry (C5b.4)
  const nodeDef = useRegistryStore.getState().resolve(options.type);
  if (!nodeDef) {
    throw new CLIError(
      'UNKNOWN_NODE_TYPE',
      `Node type '${options.type}' is not registered.`,
    );
  }

  // Resolve display name (C5b.5)
  const displayName = options.name ?? nodeDef.metadata.displayName;

  // Parse --args as JSON if provided
  let args: Record<string, string | number | boolean | string[]> | undefined;
  if (options.args) {
    try {
      args = JSON.parse(options.args);
    } catch {
      throw new CLIError('INVALID_ARGS', `Invalid JSON for --args: ${options.args}`);
    }
  }

  // Construct InlineNode (C5b.1)
  const node: InlineNode = {
    id: options.id,
    type: options.type,
    displayName,
    args,
  };

  const canvasId = resolveCanvasId(options.scope);

  if (ctx.bridgeUrl) {
    // Route through the running dev-server bridge
    const result = await bridgeMutate(ctx.bridgeUrl, 'add-node', {
      canvasId,
      node,
    });
    printSuccess(result, globalOptions);
  } else {
    // Local store mutation path
    const result = useGraphStore.getState().addNode(canvasId, node);

    if (!result.ok) {
      throw new CLIError(result.error.code, engineErrorMessage(result.error));
    }

    // Save after successful mutation (C11.1, C5b.2)
    await useFileStore.getState().saveAll(ctx.fs);

    // Output (C5b.6)
    printSuccess({ node: { id: options.id, type: options.type, displayName } }, globalOptions);
  }
}