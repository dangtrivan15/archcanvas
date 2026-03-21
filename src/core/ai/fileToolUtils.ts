/**
 * Utilities for project-scoped file tools.
 * Path validation, glob matching, binary detection, output truncation.
 */

export const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', 'build', '.archcanvas'];

/** Validate and normalize a relative path. Rejects traversal and absolute paths. */
export function validateRelativePath(path: string): string {
  // Normalize separators
  let normalized = path.replace(/\\/g, '/');

  // Strip leading ./
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  // Reject absolute paths
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`Absolute path not allowed: '${path}'`);
  }

  // Reject traversal
  const segments = normalized.split('/');
  if (segments.some((s) => s === '..')) {
    throw new Error(`Path traversal not allowed: '${path}'`);
  }

  return normalized;
}

/** Convert a glob pattern to a RegExp. Supports *, **, ? */
export function globToRegex(pattern: string): RegExp {
  let regexStr = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      // ** matches any number of path segments
      if (pattern[i + 2] === '/') {
        regexStr += '(?:.+/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (char === '*') {
      // * matches anything except /
      regexStr += '[^/]*';
      i++;
    } else if (char === '?') {
      regexStr += '[^/]';
      i++;
    } else if (char === '.') {
      regexStr += '\\.';
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

/** Check if content appears to be binary (contains null bytes in first 1024 chars). */
export function isBinaryContent(content: string): boolean {
  const sample = content.slice(0, 1024);
  return sample.includes('\0');
}

/** Truncate content to maxLines, appending a truncation message. */
export function truncateLines(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;

  const truncated = lines.slice(0, maxLines);
  const remaining = lines.length - maxLines;
  truncated.push(`... (${remaining} more lines truncated)`);
  return truncated.join('\n');
}

/** Check if a directory name should be ignored during recursive traversal. */
export function shouldIgnore(name: string): boolean {
  return DEFAULT_IGNORE.includes(name);
}
