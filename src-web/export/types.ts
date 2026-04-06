/** Supported export formats */
export type ExportFormat = 'svg' | 'markdown';

/** Configuration for an export operation */
export interface ExportOptions {
  format: ExportFormat;
}

/** Successful export result */
export interface ExportResult {
  /** The exported data — Blob for SVG, string for Markdown */
  data: Blob | string;
  /** Suggested file name */
  filename: string;
  /** MIME type */
  mimeType: string;
}

/** Export error with user-friendly message */
export class ExportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'EMPTY_CANVAS'
      | 'NO_VIEWPORT'
      | 'RENDER_FAILED'
      | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'ExportError';
    // Ensure proper prototype chain for instanceof checks in all environments
    Object.setPrototypeOf(this, ExportError.prototype);
  }
}
