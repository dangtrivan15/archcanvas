import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { loadContext, resolveCanvasId } from '../context';
import { CLIError } from '../errors';
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
  const result = useGraphStore.getState().removeEdge(canvasId, options.from, options.to);

  if (!result.ok) {
    throw new CLIError(result.error.code, engineErrorMessage(result.error));
  }

  // Save after successful mutation (C11.1, C5e.2)
  await useFileStore.getState().saveAll(ctx.fs);

  // Output (C5e.4)
  printSuccess({ removed: { from: options.from, to: options.to } }, globalOptions);
}

/** Convert an engine error object to a human-readable message. */
function engineErrorMessage(error: Record<string, unknown>): string {
  const { code, ...rest } = error;
  const details = Object.entries(rest)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(', ');
  return details ? `${String(code)}: ${details}` : String(code);
}
