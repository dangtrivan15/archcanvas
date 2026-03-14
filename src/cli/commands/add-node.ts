import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { loadContext, resolveCanvasId, bridgeMutate } from '../context';
import { CLIError, engineErrorMessage } from '../errors';
import { printSuccess, type OutputOptions } from '../output';
import type { InlineNode } from '@/types/schema';
import type { NodeDef } from '@/types/nodeDefSchema';

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
  const registry = useRegistryStore.getState();
  let nodeDef = registry.resolve(options.type);

  // If input contains '.', try replacing with '/' for an exact match
  if (!nodeDef && options.type.includes('.')) {
    const slashVariant = options.type.replaceAll('.', '/');
    nodeDef = registry.resolve(slashVariant);
    if (nodeDef) {
      // Silently fix — reassign for downstream use
      options.type = slashVariant;
    }
  }

  if (!nodeDef) {
    const hints: string[] = [
      `Node type '${options.type}' is not registered.`,
      `Node types use the format \`namespace/name\` (e.g., compute/service).`,
    ];

    // Show similar types via search — try each word and namespace matching
    const words = options.type.split(/[/.]/);
    const candidates = new Map<string, NodeDef>();

    // Search by each word in name/displayName/description/tags
    for (const word of words) {
      if (word.length === 0) continue;
      for (const def of registry.search(word)) {
        const key = `${def.metadata.namespace}/${def.metadata.name}`;
        candidates.set(key, def);
      }
    }

    // Also try namespace-based lookup (first word might be the namespace)
    if (words.length >= 1 && words[0].length > 0) {
      for (const def of registry.listByNamespace(words[0])) {
        const key = `${def.metadata.namespace}/${def.metadata.name}`;
        candidates.set(key, def);
      }
    }

    const similar = Array.from(candidates.values()).slice(0, 3);
    if (similar.length > 0) {
      const names = similar.map(
        (d) => `${d.metadata.namespace}/${d.metadata.name}`,
      );
      hints.push(`Similar types: ${names.join(', ')}`);
    }

    // Suggest the dot→slash variant if input contained '.'
    if (options.type.includes('.')) {
      const slashVariant = options.type.replaceAll('.', '/');
      hints.push(`Did you mean '${slashVariant}'?`);
    }

    hints.push(`Run \`archcanvas catalog --json\` to see all available types.`);

    throw new CLIError('UNKNOWN_NODE_TYPE', hints.join(' '));
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