/**
 * CLI-specific error class with a machine-readable error code.
 *
 * Error codes include:
 * - PROJECT_NOT_FOUND — no .archcanvas/ directory found
 * - PROJECT_EXISTS — project already initialized at target path
 * - PROJECT_LOAD_FAILED — fileStore reported an error during load
 * - UNKNOWN_NODE_TYPE — --type doesn't match any registered NodeDef
 * - INVALID_ARGS — malformed or missing CLI arguments
 * - (engine codes forwarded as-is, e.g. DUPLICATE_NODE_ID, NODE_NOT_FOUND)
 */
export class CLIError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CLIError';
  }
}
