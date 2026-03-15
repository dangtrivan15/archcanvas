import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { loadContext, resolveCanvasId, bridgeRequest } from '../context';
import { CLIError, engineErrorMessage } from '../errors';
import { printSuccess, type OutputOptions } from '../output';
import { validateAndBuildNode } from '@/core/validation/addNodeValidation';

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
  const canvasId = resolveCanvasId(options.scope);

  if (ctx.bridgeUrl) {
    // Bridge mode — send raw args, browser handles validation + enrichment
    const result = await bridgeRequest(ctx.bridgeUrl, 'add-node', {
      canvasId,
      id: options.id,
      type: options.type,
      name: options.name,
      args: options.args,
    });
    printSuccess(result.data!, globalOptions);
    return;
  }

  // Non-bridge path — local validation + mutation + save

  // Validate type, resolve displayName, parse args (C5b.1, C5b.4, C5b.5)
  const validation = validateAndBuildNode(
    { id: options.id, type: options.type, name: options.name, args: options.args },
    useRegistryStore.getState(),
  );
  if (!validation.ok) {
    throw new CLIError(validation.code, validation.message);
  }
  const node = validation.node;

  // Local store mutation path
  const result = useGraphStore.getState().addNode(canvasId, node);

  if (!result.ok) {
    throw new CLIError(result.error.code, engineErrorMessage(result.error));
  }

  // Save after successful mutation (C11.1, C5b.2)
  await useFileStore.getState().saveAll(ctx.fs!);

  // Output (C5b.6)
  printSuccess({ node: { id: node.id, type: node.type, displayName: node.displayName } }, globalOptions);
}