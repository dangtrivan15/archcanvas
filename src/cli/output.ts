import { CLIError } from './errors';

export interface OutputOptions {
  json: boolean;
}

/**
 * Format a successful result for stdout.
 *
 * - json mode: `{ ok: true, ...data }` as a JSON string
 * - human mode: data converted to readable key/value text
 */
export function formatSuccess(
  data: Record<string, unknown>,
  options: OutputOptions,
): string {
  if (options.json) {
    return JSON.stringify({ ok: true, ...data }, null, 2);
  }
  return humanReadable(data);
}

/**
 * Format an error for stderr.
 *
 * - json mode: `{ ok: false, error: { code, message } }` as a JSON string
 * - human mode: `Error: [CODE] message`
 */
export function formatError(
  error: CLIError,
  options: OutputOptions,
): string {
  if (options.json) {
    return JSON.stringify(
      { ok: false, error: { code: error.code, message: error.message } },
      null,
      2,
    );
  }
  return `Error: [${error.code}] ${error.message}`;
}

/**
 * Write success output to stdout and exit with code 0.
 */
export function printSuccess(
  data: Record<string, unknown>,
  options: OutputOptions,
): void {
  process.stdout.write(formatSuccess(data, options) + '\n');
}

/**
 * Write error output to stderr and exit with code 1.
 */
export function printError(error: CLIError, options: OutputOptions): void {
  process.stderr.write(formatError(error, options) + '\n');
}

/** Convert a data object to a simple human-readable string. */
function humanReadable(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`  ${k}: ${String(v)}`);
      }
    } else if (Array.isArray(value)) {
      lines.push(`${key}: ${value.length} items`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return lines.join('\n');
}
