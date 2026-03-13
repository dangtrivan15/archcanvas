import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { loadContext, resolveCanvasId } from '../context';
import { CLIError } from '../errors';
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
  let args: Record<string, unknown> | undefined;
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
  const result = useGraphStore.getState().addNode(canvasId, node);

  if (!result.ok) {
    throw new CLIError(result.error.code, engineErrorMessage(result.error));
  }

  // Save after successful mutation (C11.1, C5b.2)
  await useFileStore.getState().saveAll(ctx.fs);

  // Output (C5b.6)
  printSuccess({ node: { id: options.id, type: options.type, displayName } }, globalOptions);
}

/** Convert an engine error object to a human-readable message. */
function engineErrorMessage(error: Record<string, unknown>): string {
  const { code, ...rest } = error;
  const details = Object.entries(rest)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(', ');
  return details ? `${String(code)}: ${details}` : String(code);
}
