import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { loadContext, resolveCanvasId, bridgeRequest } from '../context';
import { CLIError, engineErrorMessage } from '../errors';
import { printSuccess, type OutputOptions } from '../output';

export interface RemoveNodeOptions {
  id: string;
  scope?: string;
  project?: string;
}

export async function removeNodeCommand(
  options: RemoveNodeOptions,
  globalOptions: OutputOptions,
): Promise<void> {
  const ctx = await loadContext(options.project);

  const canvasId = resolveCanvasId(options.scope);

  if (ctx.bridgeUrl) {
    // Route through the running dev-server bridge
    const result = await bridgeRequest(ctx.bridgeUrl, 'remove-node', {
      canvasId,
      nodeId: options.id,
    });
    printSuccess(result.data!, globalOptions);
  } else {
    // Local store mutation path
    const result = useGraphStore.getState().removeNode(canvasId, options.id);

    if (!result.ok) {
      throw new CLIError(result.error.code, engineErrorMessage(result.error));
    }

    // Save after successful mutation (C11.1, C5d.2)
    await useFileStore.getState().saveAll(ctx.fs!);

    // Output — confirmation (C5d.1)
    printSuccess({ removed: { id: options.id } }, globalOptions);
  }
}