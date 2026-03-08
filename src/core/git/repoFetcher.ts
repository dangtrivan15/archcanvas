/**
 * Git repository fetcher for remote .archc file resolution.
 *
 * Fetches a git repository's main.archc file at a specific tag/commit ref,
 * parses it using the existing protobuf codec, and returns the architecture data.
 *
 * Strategy:
 * 1. GitHub repos: Use GitHub Contents API (GET /repos/{owner}/{repo}/contents/main.archc?ref={ref})
 * 2. GitLab repos: Use GitLab Repository Files API
 * 3. Fallback: Attempt raw URL patterns for other git hosts
 *
 * Only supports public repos (no authentication required).
 */

import type { ArchGraph } from '@/types/graph';
import { decode } from '@/core/storage/codec';
import { protoToGraph } from '@/core/storage/fileIO';

// ─── Error Types ────────────────────────────────────────────────

/**
 * Base error for all repo fetcher errors.
 */
export class RepoFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepoFetchError';
  }
}

/**
 * Thrown when the repository cannot be found or accessed.
 */
export class RepoNotFoundError extends RepoFetchError {
  constructor(
    public readonly repoUrl: string,
    cause?: Error,
  ) {
    super(`Repository not found or not accessible: ${repoUrl}`);
    this.name = 'RepoNotFoundError';
    if (cause) this.cause = cause;
  }
}

/**
 * Thrown when the specified ref (tag or commit SHA) does not exist.
 */
export class RefNotFoundError extends RepoFetchError {
  constructor(
    public readonly repoUrl: string,
    public readonly ref: string,
    cause?: Error,
  ) {
    super(`Ref not found: "${ref}" in ${repoUrl}`);
    this.name = 'RefNotFoundError';
    if (cause) this.cause = cause;
  }
}

/**
 * Thrown when main.archc is not found at the repo root.
 */
export class ArchcNotFoundError extends RepoFetchError {
  constructor(
    public readonly repoUrl: string,
    public readonly ref: string,
  ) {
    super(`main.archc not found at root of ${repoUrl} (ref: ${ref})`);
    this.name = 'ArchcNotFoundError';
  }
}

/**
 * Thrown when the repository is private or requires authentication.
 */
export class RepoNotPublicError extends RepoFetchError {
  constructor(public readonly repoUrl: string) {
    super(`Repository is not public or requires authentication: ${repoUrl}`);
    this.name = 'RepoNotPublicError';
  }
}

// ─── URL Parsing ────────────────────────────────────────────────

/**
 * Parsed repository information from a URL.
 */
export interface ParsedRepoUrl {
  /** The hosting platform type */
  platform: 'github' | 'gitlab' | 'unknown';
  /** Repository owner/organization */
  owner: string;
  /** Repository name */
  repo: string;
  /** The original URL */
  originalUrl: string;
}

/**
 * Parse a git repository URL into its components.
 *
 * Supports formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://gitlab.com/owner/repo
 * - https://gitlab.com/owner/repo.git
 * - git@github.com:owner/repo.git (SSH)
 */
export function parseRepoUrl(repoUrl: string): ParsedRepoUrl {
  const url = repoUrl.trim();

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    const host = sshMatch[1]!.toLowerCase();
    const owner = sshMatch[2]!;
    const repo = sshMatch[3]!;
    return {
      platform: host.includes('github') ? 'github' : host.includes('gitlab') ? 'gitlab' : 'unknown',
      owner,
      repo,
      originalUrl: url,
    };
  }

  // HTTPS format: https://github.com/owner/repo(.git)?
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (httpsMatch) {
    const host = httpsMatch[1]!.toLowerCase();
    const owner = httpsMatch[2]!;
    const repo = httpsMatch[3]!;
    return {
      platform: host.includes('github.com') ? 'github' : host.includes('gitlab.com') ? 'gitlab' : 'unknown',
      owner,
      repo,
      originalUrl: url,
    };
  }

  throw new RepoFetchError(`Cannot parse repository URL: ${url}`);
}

// ─── Fetch Strategies ───────────────────────────────────────────

/**
 * Options for fetching.
 */
export interface FetchOptions {
  /** Custom fetch function (for testing/injection). Defaults to globalThis.fetch */
  fetchFn?: typeof fetch;
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Create an AbortSignal that times out after the given duration.
 */
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Fetch main.archc from a GitHub repository using the Contents API.
 *
 * Uses: GET /repos/{owner}/{repo}/contents/main.archc?ref={ref}
 * With Accept: application/vnd.github.raw+json to get raw binary content.
 */
async function fetchFromGitHub(
  owner: string,
  repo: string,
  ref: string,
  options: FetchOptions,
): Promise<Uint8Array> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/main.archc?ref=${encodeURIComponent(ref)}`;

  const response = await fetchFn(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      'User-Agent': 'ArchCanvas',
    },
    signal: createTimeoutSignal(timeoutMs),
  });

  if (response.status === 404) {
    // Determine if repo or file is missing by checking the repo itself
    const repoCheckUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const repoResponse = await fetchFn(repoCheckUrl, {
      headers: { 'User-Agent': 'ArchCanvas' },
      signal: createTimeoutSignal(timeoutMs),
    });

    if (repoResponse.status === 404) {
      throw new RepoNotFoundError(`https://github.com/${owner}/${repo}`);
    }

    // Repo exists, check if it's a ref issue or file issue
    // Try to fetch just the root to see if the ref exists
    const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}`;
    const treeResponse = await fetchFn(treeUrl, {
      headers: { 'User-Agent': 'ArchCanvas' },
      signal: createTimeoutSignal(timeoutMs),
    });

    if (treeResponse.status === 404) {
      throw new RefNotFoundError(`https://github.com/${owner}/${repo}`, ref);
    }

    throw new ArchcNotFoundError(`https://github.com/${owner}/${repo}`, ref);
  }

  if (response.status === 403) {
    throw new RepoNotPublicError(`https://github.com/${owner}/${repo}`);
  }

  if (!response.ok) {
    throw new RepoFetchError(
      `GitHub API error: ${response.status} ${response.statusText} for ${owner}/${repo}@${ref}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Fetch main.archc from a GitLab repository using the Repository Files API.
 *
 * Uses: GET /api/v4/projects/{id}/repository/files/main.archc/raw?ref={ref}
 */
async function fetchFromGitLab(
  owner: string,
  repo: string,
  ref: string,
  options: FetchOptions,
): Promise<Uint8Array> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const projectId = encodeURIComponent(`${owner}/${repo}`);
  const filePath = encodeURIComponent('main.archc');
  const apiUrl = `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${filePath}/raw?ref=${encodeURIComponent(ref)}`;

  const response = await fetchFn(apiUrl, {
    headers: { 'User-Agent': 'ArchCanvas' },
    signal: createTimeoutSignal(timeoutMs),
  });

  if (response.status === 404) {
    // Could be repo not found, ref not found, or file not found
    // Check if the project exists
    const projectUrl = `https://gitlab.com/api/v4/projects/${projectId}`;
    const projectResponse = await fetchFn(projectUrl, {
      headers: { 'User-Agent': 'ArchCanvas' },
      signal: createTimeoutSignal(timeoutMs),
    });

    if (projectResponse.status === 404) {
      throw new RepoNotFoundError(`https://gitlab.com/${owner}/${repo}`);
    }

    // Project exists; check ref via branches/tags API
    const refUrl = `https://gitlab.com/api/v4/projects/${projectId}/repository/branches/${encodeURIComponent(ref)}`;
    const tagUrl = `https://gitlab.com/api/v4/projects/${projectId}/repository/tags/${encodeURIComponent(ref)}`;

    const [branchRes, tagRes] = await Promise.all([
      fetchFn(refUrl, { headers: { 'User-Agent': 'ArchCanvas' }, signal: createTimeoutSignal(timeoutMs) }),
      fetchFn(tagUrl, { headers: { 'User-Agent': 'ArchCanvas' }, signal: createTimeoutSignal(timeoutMs) }),
    ]);

    if (branchRes.status === 404 && tagRes.status === 404) {
      throw new RefNotFoundError(`https://gitlab.com/${owner}/${repo}`, ref);
    }

    throw new ArchcNotFoundError(`https://gitlab.com/${owner}/${repo}`, ref);
  }

  if (response.status === 403 || response.status === 401) {
    throw new RepoNotPublicError(`https://gitlab.com/${owner}/${repo}`);
  }

  if (!response.ok) {
    throw new RepoFetchError(
      `GitLab API error: ${response.status} ${response.statusText} for ${owner}/${repo}@${ref}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Fallback: Attempt to fetch main.archc via raw URL patterns for unknown hosts.
 * Tries common raw file URL patterns.
 */
async function fetchFromUnknownHost(
  repoUrl: string,
  ref: string,
  options: FetchOptions,
): Promise<Uint8Array> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Try common raw URL patterns
  const baseUrl = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
  const patterns = [
    `${baseUrl}/raw/${encodeURIComponent(ref)}/main.archc`,      // Gitea/Forgejo pattern
    `${baseUrl}/-/raw/${encodeURIComponent(ref)}/main.archc`,    // GitLab-like pattern
    `${baseUrl}/plain/main.archc?id=${encodeURIComponent(ref)}`, // cgit pattern
  ];

  for (const url of patterns) {
    try {
      const response = await fetchFn(url, {
        headers: { 'User-Agent': 'ArchCanvas' },
        signal: createTimeoutSignal(timeoutMs),
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
    } catch {
      // Try next pattern
      continue;
    }
  }

  throw new RepoFetchError(
    `Could not fetch main.archc from ${repoUrl} at ref "${ref}". ` +
    `The repository host is not recognized. Supported: GitHub, GitLab.`,
  );
}

// ─── Main API ───────────────────────────────────────────────────

/**
 * Result of fetching and parsing a remote .archc file.
 */
export interface RepoFetchResult {
  /** The parsed architecture graph */
  graph: ArchGraph;
  /** The repo URL that was fetched */
  repoUrl: string;
  /** The ref (tag/commit) that was resolved */
  ref: string;
  /** The raw binary data (for caching) */
  rawData: Uint8Array;
}

/**
 * Fetch and parse main.archc from a remote git repository.
 *
 * 1. Parses the repo URL to determine the hosting platform
 * 2. Fetches main.archc at the specified ref using the appropriate API
 * 3. Decodes the .archc binary using the existing protobuf codec
 * 4. Returns the parsed architecture graph
 *
 * @param repoUrl - Git repository URL (HTTPS or SSH)
 * @param ref - Tag name or commit SHA to fetch
 * @param options - Optional fetch configuration
 * @returns The parsed architecture data
 *
 * @throws {RepoNotFoundError} If the repository doesn't exist
 * @throws {RefNotFoundError} If the tag/commit doesn't exist
 * @throws {ArchcNotFoundError} If main.archc is not at the repo root
 * @throws {RepoNotPublicError} If the repo requires authentication
 * @throws {RepoFetchError} For other fetch errors
 */
export async function fetchRepoArchc(
  repoUrl: string,
  ref: string,
  options: FetchOptions = {},
): Promise<RepoFetchResult> {
  if (!repoUrl || !repoUrl.trim()) {
    throw new RepoFetchError('Repository URL is required');
  }
  if (!ref || !ref.trim()) {
    throw new RepoFetchError('Ref (tag or commit SHA) is required');
  }

  const parsed = parseRepoUrl(repoUrl);
  let rawData: Uint8Array;

  switch (parsed.platform) {
    case 'github':
      rawData = await fetchFromGitHub(parsed.owner, parsed.repo, ref, options);
      break;
    case 'gitlab':
      rawData = await fetchFromGitLab(parsed.owner, parsed.repo, ref, options);
      break;
    default:
      rawData = await fetchFromUnknownHost(repoUrl, ref, options);
      break;
  }

  // Parse the .archc binary using existing codec
  let graph: ArchGraph;
  try {
    const decoded = await decode(rawData);
    graph = protoToGraph(decoded);
  } catch (err) {
    throw new RepoFetchError(
      `Failed to parse main.archc from ${repoUrl}@${ref}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    graph,
    repoUrl,
    ref,
    rawData,
  };
}
