const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;

export function validateSemver(version: string): boolean {
  return SEMVER_RE.test(version);
}

export const RESERVED_NAMESPACES = new Set([
  'compute',
  'data',
  'messaging',
  'network',
  'client',
  'integration',
  'security',
  'observability',
  'ai',
]);
