import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { loadContext, resolveCanvasId, bridgeRequest } from '../context';
import { CLIError, engineErrorMessage } from '../errors';
import { printSuccess, type OutputOptions } from '../output';

export interface RemoveEdgeOptions {
  from: string;
  to: string;
  scope?: string;
  project?: string;
}

export async function removeEdgeCommand(
  options: RemoveEdgeOptions,
  globalOptions: OutputOptions,
): Promise<void> {
  const ctx = await loadContext(options.project);

  const canvasId = resolveCanvasId(options.scope);

  if (ctx.bridgeUrl) {
    // Route through the running dev-server bridge
    const result = await bridgeRequest(ctx.bridgeUrl, 'remove-edge', {
      canvasId,
      from: options.from,
      to: options.to,
    });
    printSuccess(result.data!, globalOptions);
  } else {
    // Local store mutation path
    const result = useGraphStore.getState().removeEdge(canvasId, options.from, options.to);

    if (!result.ok) {
      throw new CLIError(result.error.code, engineErrorMessage(result.error));
    }

    // Save after successful mutation (C11.1, C5e.2)
    await useFileStore.getState().saveAll(ctx.fs!);

    // Output (C5e.4)
    printSuccess({ removed: { from: options.from, to: options.to } }, globalOptions);
  }
}