/**
 * Tests for the git repo fetcher module.
 * Verifies URL parsing, fetch strategies, error handling, and .archc parsing.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseRepoUrl,
  fetchRepoArchc,
  RepoFetchError,
  RepoNotFoundError,
  RefNotFoundError,
  ArchcNotFoundError,
  RepoNotPublicError,
} from '@/core/git/repoFetcher';
import { encode } from '@/core/storage/codec';
import {
  ArchCanvasFile,
  FileHeader,
  Architecture,
  Node,
  Position,
  Value,
} from '@/proto/archcanvas';
import { FORMAT_VERSION } from '@/utils/constants';

// ─── Test Helpers ───────────────────────────────────────────────

/**
 * Create a minimal valid .archc binary for testing.
 */
async function createTestArchcBinary(): Promise<Uint8Array> {
  const file = ArchCanvasFile.create({
    header: FileHeader.create({
      formatVersion: FORMAT_VERSION,
      toolVersion: '0.1.0',
      createdAtMs: 1700000000000,
      updatedAtMs: 1700000001000,
    }),
    architecture: Architecture.create({
      name: 'Test Architecture',
      description: 'A test architecture from a remote repo',
      owners: ['test-owner'],
      nodes: [
        Node.create({
          id: 'svc-1',
          type: 'compute/service',
          displayName: 'Test Service',
          args: {
            runtime: Value.create({ stringValue: 'node' }),
          },
          position: Position.create({ x: 100, y: 200, width: 240, height: 120 }),
        }),
      ],
      edges: [],
    }),
  });
  return encode(file);
}

/**
 * Create a mock fetch function that returns a specific response.
 */
function createMockFetch(responses: Record<string, { status: number; body?: ArrayBuffer | object; ok?: boolean }>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Find matching pattern
    for (const [pattern, config] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        const ok = config.ok ?? (config.status >= 200 && config.status < 300);
        return {
          status: config.status,
          statusText: config.status === 200 ? 'OK' : config.status === 404 ? 'Not Found' : 'Error',
          ok,
          arrayBuffer: async () => config.body instanceof ArrayBuffer ? config.body : new ArrayBuffer(0),
          json: async () => config.body && !(config.body instanceof ArrayBuffer) ? config.body : {},
          headers: new Headers(),
        } as Response;
      }
    }

    // Default: 404
    return {
      status: 404,
      statusText: 'Not Found',
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      json: async () => ({}),
      headers: new Headers(),
    } as Response;
  }) as unknown as typeof fetch;
}

// ─── URL Parsing Tests ──────────────────────────────────────────

describe('parseRepoUrl', () => {
  it('parses GitHub HTTPS URL', () => {
    const result = parseRepoUrl('https://github.com/acme/my-repo');
    expect(result.platform).toBe('github');
    expect(result.owner).toBe('acme');
    expect(result.repo).toBe('my-repo');
  });

  it('parses GitHub HTTPS URL with .git suffix', () => {
    const result = parseRepoUrl('https://github.com/acme/my-repo.git');
    expect(result.platform).toBe('github');
    expect(result.owner).toBe('acme');
    expect(result.repo).toBe('my-repo');
  });

  it('parses GitLab HTTPS URL', () => {
    const result = parseRepoUrl('https://gitlab.com/acme/my-repo');
    expect(result.platform).toBe('gitlab');
    expect(result.owner).toBe('acme');
    expect(result.repo).toBe('my-repo');
  });

  it('parses GitLab HTTPS URL with .git suffix', () => {
    const result = parseRepoUrl('https://gitlab.com/acme/my-repo.git');
    expect(result.platform).toBe('gitlab');
    expect(result.owner).toBe('acme');
    expect(result.repo).toBe('my-repo');
  });

  it('parses GitHub SSH URL', () => {
    const result = parseRepoUrl('git@github.com:acme/my-repo.git');
    expect(result.platform).toBe('github');
    expect(result.owner).toBe('acme');
    expect(result.repo).toBe('my-repo');
  });

  it('parses unknown host as unknown platform', () => {
    const result = parseRepoUrl('https://gitea.example.com/acme/my-repo');
    expect(result.platform).toBe('unknown');
    expect(result.owner).toBe('acme');
    expect(result.repo).toBe('my-repo');
  });

  it('trims whitespace from URL', () => {
    const result = parseRepoUrl('  https://github.com/acme/repo  ');
    expect(result.platform).toBe('github');
    expect(result.owner).toBe('acme');
    expect(result.repo).toBe('repo');
  });

  it('handles trailing slash', () => {
    const result = parseRepoUrl('https://github.com/acme/repo/');
    expect(result.platform).toBe('github');
    expect(result.owner).toBe('acme');
    expect(result.repo).toBe('repo');
  });

  it('throws for invalid URL format', () => {
    expect(() => parseRepoUrl('not-a-url')).toThrow(RepoFetchError);
    expect(() => parseRepoUrl('not-a-url')).toThrow('Cannot parse repository URL');
  });

  it('preserves original URL', () => {
    const url = 'https://github.com/acme/my-repo.git';
    const result = parseRepoUrl(url);
    expect(result.originalUrl).toBe(url);
  });
});

// ─── fetchRepoArchc: Validation ─────────────────────────────────

describe('fetchRepoArchc - validation', () => {
  it('throws when repoUrl is empty', async () => {
    await expect(fetchRepoArchc('', 'v1.0')).rejects.toThrow(RepoFetchError);
    await expect(fetchRepoArchc('', 'v1.0')).rejects.toThrow('Repository URL is required');
  });

  it('throws when ref is empty', async () => {
    await expect(fetchRepoArchc('https://github.com/a/b', '')).rejects.toThrow(RepoFetchError);
    await expect(fetchRepoArchc('https://github.com/a/b', '')).rejects.toThrow('Ref (tag or commit SHA) is required');
  });

  it('throws when repoUrl is whitespace-only', async () => {
    await expect(fetchRepoArchc('   ', 'v1.0')).rejects.toThrow('Repository URL is required');
  });

  it('throws when ref is whitespace-only', async () => {
    await expect(fetchRepoArchc('https://github.com/a/b', '  ')).rejects.toThrow('Ref (tag or commit SHA) is required');
  });
});

// ─── fetchRepoArchc: GitHub Success ─────────────────────────────

describe('fetchRepoArchc - GitHub success', () => {
  it('fetches and parses main.archc from GitHub', async () => {
    const archcBinary = await createTestArchcBinary();

    const mockFetch = createMockFetch({
      'api.github.com/repos/acme/arch-repo/contents/main.archc': {
        status: 200,
        body: archcBinary.buffer as ArrayBuffer,
      },
    });

    const result = await fetchRepoArchc(
      'https://github.com/acme/arch-repo',
      'v1.0.0',
      { fetchFn: mockFetch },
    );

    expect(result.graph).toBeDefined();
    expect(result.graph.name).toBe('Test Architecture');
    expect(result.graph.description).toBe('A test architecture from a remote repo');
    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.nodes[0]!.displayName).toBe('Test Service');
    expect(result.repoUrl).toBe('https://github.com/acme/arch-repo');
    expect(result.ref).toBe('v1.0.0');
    expect(result.rawData).toBeInstanceOf(Uint8Array);
    expect(result.rawData.length).toBeGreaterThan(0);
  });

  it('passes correct ref as query parameter', async () => {
    const archcBinary = await createTestArchcBinary();

    const mockFetch = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      ok: true,
      arrayBuffer: async () => archcBinary.buffer as ArrayBuffer,
      headers: new Headers(),
    })) as unknown as typeof fetch;

    await fetchRepoArchc(
      'https://github.com/acme/arch-repo',
      'abc123def',
      { fetchFn: mockFetch },
    );

    const calledUrl = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(calledUrl).toContain('ref=abc123def');
    expect(calledUrl).toContain('contents/main.archc');
  });
});

// ─── fetchRepoArchc: GitHub Errors ──────────────────────────────

describe('fetchRepoArchc - GitHub errors', () => {
  it('throws RepoNotFoundError when repo does not exist', async () => {
    const mockFetch = createMockFetch({
      'contents/main.archc': { status: 404 },
      'api.github.com/repos/acme/nonexistent': { status: 404 },
    });

    await expect(
      fetchRepoArchc('https://github.com/acme/nonexistent', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow(RepoNotFoundError);
  });

  it('throws RefNotFoundError when ref does not exist', async () => {
    // We need precise URL matching: the contents URL returns 404,
    // repo check returns 200, tree check returns 404
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('contents/main.archc')) {
        return { status: 404, statusText: 'Not Found', ok: false, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers() } as Response;
      }
      if (url.includes('git/trees/')) {
        return { status: 404, statusText: 'Not Found', ok: false, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers() } as Response;
      }
      // Default: repo exists
      return { status: 200, statusText: 'OK', ok: true, arrayBuffer: async () => new ArrayBuffer(0), json: async () => ({}), headers: new Headers() } as Response;
    }) as unknown as typeof fetch;

    await expect(
      fetchRepoArchc('https://github.com/acme/repo', 'bad-tag', { fetchFn: mockFetch }),
    ).rejects.toThrow(RefNotFoundError);
  });

  it('throws ArchcNotFoundError when main.archc is missing', async () => {
    const mockFetch = createMockFetch({
      'contents/main.archc': { status: 404 },
      'api.github.com/repos/acme/repo': { status: 200, body: {} },  // repo exists
      'git/trees/v1.0': { status: 200, body: {} },                  // ref exists
    });

    await expect(
      fetchRepoArchc('https://github.com/acme/repo', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow(ArchcNotFoundError);
  });

  it('throws RepoNotPublicError on 403', async () => {
    const mockFetch = createMockFetch({
      'contents/main.archc': { status: 403 },
    });

    await expect(
      fetchRepoArchc('https://github.com/acme/private-repo', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow(RepoNotPublicError);
  });

  it('throws RepoFetchError on unexpected status code', async () => {
    const mockFetch = createMockFetch({
      'contents/main.archc': { status: 500 },
    });

    await expect(
      fetchRepoArchc('https://github.com/acme/repo', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow(RepoFetchError);
  });
});

// ─── fetchRepoArchc: GitLab ─────────────────────────────────────

describe('fetchRepoArchc - GitLab', () => {
  it('fetches from GitLab using correct API endpoint', async () => {
    const archcBinary = await createTestArchcBinary();

    const mockFetch = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      ok: true,
      arrayBuffer: async () => archcBinary.buffer as ArrayBuffer,
      headers: new Headers(),
    })) as unknown as typeof fetch;

    const result = await fetchRepoArchc(
      'https://gitlab.com/acme/arch-repo',
      'v2.0',
      { fetchFn: mockFetch },
    );

    expect(result.graph.name).toBe('Test Architecture');

    const calledUrl = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(calledUrl).toContain('gitlab.com/api/v4/projects');
    expect(calledUrl).toContain('files/main.archc/raw');
    expect(calledUrl).toContain('ref=v2.0');
  });

  it('throws RepoNotFoundError for missing GitLab repo', async () => {
    const mockFetch = createMockFetch({
      'files/main.archc/raw': { status: 404 },
      'api/v4/projects/acme%2Fnonexistent': { status: 404 },
    });

    await expect(
      fetchRepoArchc('https://gitlab.com/acme/nonexistent', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow(RepoNotFoundError);
  });

  it('throws RepoNotPublicError on GitLab 403', async () => {
    const mockFetch = createMockFetch({
      'files/main.archc/raw': { status: 403 },
    });

    await expect(
      fetchRepoArchc('https://gitlab.com/acme/private', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow(RepoNotPublicError);
  });
});

// ─── fetchRepoArchc: Unknown Host Fallback ──────────────────────

describe('fetchRepoArchc - unknown host fallback', () => {
  it('tries raw URL patterns for unknown hosts', async () => {
    const archcBinary = await createTestArchcBinary();

    // First pattern (Gitea) succeeds
    const mockFetch = createMockFetch({
      'raw/v1.0/main.archc': {
        status: 200,
        body: archcBinary.buffer as ArrayBuffer,
      },
    });

    const result = await fetchRepoArchc(
      'https://gitea.example.com/acme/repo',
      'v1.0',
      { fetchFn: mockFetch },
    );

    expect(result.graph.name).toBe('Test Architecture');
  });

  it('throws RepoFetchError when all fallback patterns fail', async () => {
    const mockFetch = createMockFetch({});

    await expect(
      fetchRepoArchc('https://gitea.example.com/acme/repo', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow(RepoFetchError);
    await expect(
      fetchRepoArchc('https://gitea.example.com/acme/repo', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow('not recognized');
  });
});

// ─── fetchRepoArchc: .archc Parsing ─────────────────────────────

describe('fetchRepoArchc - .archc parsing', () => {
  it('throws RepoFetchError when binary data is not valid .archc', async () => {
    const invalidData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const mockFetch = createMockFetch({
      'contents/main.archc': {
        status: 200,
        body: invalidData.buffer as ArrayBuffer,
      },
    });

    await expect(
      fetchRepoArchc('https://github.com/acme/repo', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow(RepoFetchError);
    await expect(
      fetchRepoArchc('https://github.com/acme/repo', 'v1.0', { fetchFn: mockFetch }),
    ).rejects.toThrow('Failed to parse main.archc');
  });

  it('returns architecture data with correct node count', async () => {
    // Create a binary with multiple nodes
    const file = ArchCanvasFile.create({
      header: FileHeader.create({ formatVersion: FORMAT_VERSION }),
      architecture: Architecture.create({
        name: 'Multi-Node Arch',
        nodes: [
          Node.create({ id: 'n1', type: 'compute/service', displayName: 'Service A', position: Position.create({ x: 0, y: 0 }) }),
          Node.create({ id: 'n2', type: 'storage/database', displayName: 'DB', position: Position.create({ x: 200, y: 0 }) }),
          Node.create({ id: 'n3', type: 'network/api-gateway', displayName: 'Gateway', position: Position.create({ x: 100, y: 100 }) }),
        ],
      }),
    });
    const binary = await encode(file);

    const mockFetch = createMockFetch({
      'contents/main.archc': {
        status: 200,
        body: binary.buffer as ArrayBuffer,
      },
    });

    const result = await fetchRepoArchc(
      'https://github.com/acme/multi-node',
      'main',
      { fetchFn: mockFetch },
    );

    expect(result.graph.nodes).toHaveLength(3);
    expect(result.graph.nodes.map((n) => n.displayName)).toEqual(['Service A', 'DB', 'Gateway']);
  });

  it('returns raw binary data for caching', async () => {
    const archcBinary = await createTestArchcBinary();

    const mockFetch = createMockFetch({
      'contents/main.archc': {
        status: 200,
        body: archcBinary.buffer as ArrayBuffer,
      },
    });

    const result = await fetchRepoArchc(
      'https://github.com/acme/repo',
      'v1.0',
      { fetchFn: mockFetch },
    );

    expect(result.rawData).toBeInstanceOf(Uint8Array);
    expect(result.rawData.length).toBe(archcBinary.length);
  });
});

// ─── Error Type Checks ──────────────────────────────────────────

describe('error types', () => {
  it('RepoFetchError is base class for all errors', () => {
    expect(new RepoNotFoundError('url')).toBeInstanceOf(RepoFetchError);
    expect(new RefNotFoundError('url', 'ref')).toBeInstanceOf(RepoFetchError);
    expect(new ArchcNotFoundError('url', 'ref')).toBeInstanceOf(RepoFetchError);
    expect(new RepoNotPublicError('url')).toBeInstanceOf(RepoFetchError);
  });

  it('error names are set correctly', () => {
    expect(new RepoFetchError('msg').name).toBe('RepoFetchError');
    expect(new RepoNotFoundError('url').name).toBe('RepoNotFoundError');
    expect(new RefNotFoundError('url', 'ref').name).toBe('RefNotFoundError');
    expect(new ArchcNotFoundError('url', 'ref').name).toBe('ArchcNotFoundError');
    expect(new RepoNotPublicError('url').name).toBe('RepoNotPublicError');
  });

  it('RepoNotFoundError stores repoUrl', () => {
    const err = new RepoNotFoundError('https://github.com/x/y');
    expect(err.repoUrl).toBe('https://github.com/x/y');
  });

  it('RefNotFoundError stores repoUrl and ref', () => {
    const err = new RefNotFoundError('https://github.com/x/y', 'v9.9');
    expect(err.repoUrl).toBe('https://github.com/x/y');
    expect(err.ref).toBe('v9.9');
  });

  it('ArchcNotFoundError stores repoUrl and ref', () => {
    const err = new ArchcNotFoundError('https://github.com/x/y', 'main');
    expect(err.repoUrl).toBe('https://github.com/x/y');
    expect(err.ref).toBe('main');
  });
});
