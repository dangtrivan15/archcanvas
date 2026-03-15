import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { loadContext, resolveCanvasId, bridgeRequest } from '../context';
import { CLIError, engineErrorMessage } from '../errors';
import { printSuccess, type OutputOptions } from '../output';
import type { Edge } from '@/types/schema';

export interface AddEdgeOptions {
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  protocol?: string;
  label?: string;
  scope?: string;
  project?: string;
}

export async function addEdgeCommand(
  options: AddEdgeOptions,
  globalOptions: OutputOptions,
): Promise<void> {
  const ctx = await loadContext(options.project);

  // Construct Edge (C5c.1)
  const edge: Edge = {
    from: { node: options.from, port: options.fromPort },
    to: { node: options.to, port: options.toPort },
    protocol: options.protocol,
    label: options.label,
  };

  const canvasId = resolveCanvasId(options.scope);

  if (ctx.bridgeUrl) {
    // Route through the running dev-server bridge
    const result = await bridgeRequest(ctx.bridgeUrl, 'add-edge', {
      canvasId,
      edge,
    });
    printSuccess(result.data!, globalOptions);
  } else {
    // Local store mutation path
    const result = useGraphStore.getState().addEdge(canvasId, edge);

    if (!result.ok) {
      throw new CLIError(result.error.code, engineErrorMessage(result.error));
    }

    // Save after successful mutation (C11.1, C5c.2)
    await useFileStore.getState().saveAll(ctx.fs!);

    // Output (C5c.4)
    printSuccess(
      { edge: { from: options.from, to: options.to, protocol: options.protocol, label: options.label } },
      globalOptions,
    );
  }
}