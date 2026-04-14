// ---------------------------------------------------------------------------
// Semver parsing, version constraints, and type reference parsing
// ---------------------------------------------------------------------------

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export interface VersionConstraint {
  type: 'exact' | 'caret' | 'tilde';
  version: SemVer;
}

export interface TypeRef {
  typeKey: string;
  constraint?: VersionConstraint;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Parse a semver string (e.g., '1.2.3') into a SemVer object.
 * Returns null for non-matching input.
 */
export function parseSemVer(raw: string): SemVer | null {
  const match = SEMVER_RE.exec(raw);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Parse a version constraint string (e.g., '^1.2.3', '~1.0.0', '1.2.3').
 * Returns null for non-matching input.
 */
export function parseVersionConstraint(
  raw: string,
): VersionConstraint | null {
  let type: VersionConstraint['type'] = 'exact';
  let versionPart = raw;

  if (raw.startsWith('^')) {
    type = 'caret';
    versionPart = raw.slice(1);
  } else if (raw.startsWith('~')) {
    type = 'tilde';
    versionPart = raw.slice(1);
  }

  const version = parseSemVer(versionPart);
  if (!version) return null;

  return { type, version };
}

/**
 * Parse a type field value (e.g., 'data/database@^1.0.0') into a TypeRef.
 * If no '@', returns { typeKey, constraint: undefined }.
 * If '@' present but constraint is invalid, returns { typeKey, constraint: undefined }.
 */
export function parseTypeRef(typeField: string): TypeRef {
  const atIdx = typeField.indexOf('@');
  if (atIdx === -1) {
    return { typeKey: typeField };
  }

  const typeKey = typeField.substring(0, atIdx);
  const constraintStr = typeField.substring(atIdx + 1);
  const constraint = parseVersionConstraint(constraintStr) ?? undefined;

  return { typeKey, constraint };
}

/**
 * Check whether a concrete version satisfies a constraint.
 *
 * - exact:  all three components must match
 * - caret:  major must match; (minor, patch) >= constraint; if major === 0, minor must also match (npm convention)
 * - tilde:  major AND minor must match; patch >= constraint.patch
 */
export function versionSatisfies(
  actual: SemVer,
  constraint: VersionConstraint,
): boolean {
  const { version: c } = constraint;

  switch (constraint.type) {
    case 'exact':
      return (
        actual.major === c.major &&
        actual.minor === c.minor &&
        actual.patch === c.patch
      );

    case 'caret':
      if (actual.major !== c.major) return false;
      // Special case: major === 0 pins minor too
      if (c.major === 0) {
        if (actual.minor !== c.minor) return false;
        return actual.patch >= c.patch;
      }
      if (actual.minor > c.minor) return true;
      if (actual.minor === c.minor) return actual.patch >= c.patch;
      return false;

    case 'tilde':
      return (
        actual.major === c.major &&
        actual.minor === c.minor &&
        actual.patch >= c.patch
      );
  }
}

/**
 * Compare two SemVer values. Returns -1, 0, or 1.
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Format a SemVer as a string, e.g. '1.2.3'.
 */
export function formatSemVer(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/**
 * Format a VersionConstraint as a string, e.g. '^1.2.3'.
 */
export function formatConstraint(c: VersionConstraint): string {
  const ver = formatSemVer(c.version);
  switch (c.type) {
    case 'exact':
      return ver;
    case 'caret':
      return `^${ver}`;
    case 'tilde':
      return `~${ver}`;
  }
}
