// ---------------------------------------------------------------------------
// Remote Registry API client
// All network calls to registry.archcanvas.dev are isolated here.
// ---------------------------------------------------------------------------

import { z } from 'zod/v4';

const RemoteNodeDefSummarySchema = z.object({
  namespace: z.string(),
  name: z.string(),
  latestVer: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  downloadCount: z.number().default(0),
});

export type RemoteNodeDefSummary = z.infer<typeof RemoteNodeDefSummarySchema>;

const BrowseResultSchema = z.object({
  items: z.array(RemoteNodeDefSummarySchema),
  total: z.number(),
});

export type BrowseResult = z.infer<typeof BrowseResultSchema>;

const NamespacesResponseSchema = z.object({
  namespaces: z.array(
    z.object({
      namespace: z.string(),
      count: z.number(),
    }),
  ),
});

const TagsResultSchema = z.object({
  tags: z.array(z.object({ tag: z.string(), count: z.number() })),
});

const RemoteNodeDefDetailSchema = z.object({
  nodedef: RemoteNodeDefSummarySchema,
  version: z.object({
    nodedefId: z.string(),
    version: z.string(),
    blob: z.record(z.string(), z.unknown()),
    publishedBySub: z.string().optional(),
    publishedAt: z.string(),
  }),
});

export type RemoteNodeDefDetail = z.infer<typeof RemoteNodeDefDetailSchema>;

const RemoteVersionSummarySchema = z.object({
  version: z.string(),
  publishedAt: z.string(),
  downloadCount: z.number(),
});

const VersionHistoryResponseSchema = z.object({
  versions: z.array(RemoteVersionSummarySchema),
});

export type RemoteVersionSummary = z.infer<typeof RemoteVersionSummarySchema>;

export const REGISTRY_BASE_URL = 'https://registry.archcanvas.dev';

/** The three sort options accepted by GET /api/v1/nodedefs?sort= */
export type SortOption = 'downloads' | 'recent' | 'name';

/**
 * Fetch the full version history for a NodeDef, ordered newest-first.
 * Each entry includes the publish date and deduplicated download count.
 */
export async function fetchNodeDefVersions(
  namespace: string,
  name: string,
  signal?: AbortSignal,
): Promise<RemoteVersionSummary[]> {
  const url = `${REGISTRY_BASE_URL}/api/v1/nodedefs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/versions`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Failed to fetch version history: ${resp.status}`);
  const data = (await resp.json()) as unknown;
  const parsed = VersionHistoryResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error('Version history endpoint returned unexpected response shape');
  return parsed.data.versions;
}

/**
 * Search the community registry for NodeDefs matching the given query.
 * Throws on network errors, non-OK HTTP responses, or AbortError (signal cancelled).
 */
export async function searchRegistry(
  query: string,
  signal?: AbortSignal,
): Promise<RemoteNodeDefSummary[]> {
  const url = `${REGISTRY_BASE_URL}/api/v1/nodedefs?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Registry search failed: ${resp.status}`);
  const data = (await resp.json()) as unknown;
  const parsed = BrowseResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Registry returned unexpected response shape`);
  }
  return parsed.data.items;
}

/**
 * Browse the community registry with optional filters.
 */
export async function browseRegistry(
  opts: { q?: string; namespace?: string; tag?: string; sort?: SortOption; page?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<{ items: RemoteNodeDefSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.namespace) params.set('namespace', opts.namespace);
  if (opts.tag) params.set('tag', opts.tag);
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.page !== undefined) params.set('page', String(opts.page));
  if (opts.pageSize !== undefined) params.set('pageSize', String(opts.pageSize));
  const qs = params.toString();
  const url = `${REGISTRY_BASE_URL}/api/v1/nodedefs${qs ? '?' + qs : ''}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Registry browse failed: ${resp.status}`);
  const data = (await resp.json()) as unknown;
  const parsed = BrowseResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Registry returned unexpected response shape`);
  }
  return parsed.data;
}

/**
 * Fetch the list of namespaces with their nodedef counts.
 */
export async function fetchNamespaces(
  signal?: AbortSignal,
): Promise<Array<{ namespace: string; count: number }>> {
  const url = `${REGISTRY_BASE_URL}/api/v1/namespaces`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Failed to fetch namespaces: ${resp.status}`);
  const data = (await resp.json()) as unknown;
  const parsed = NamespacesResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Namespaces endpoint returned unexpected response shape');
  }
  return parsed.data.namespaces;
}

/**
 * Fetch the list of tags with their nodedef counts.
 */
export async function fetchTags(
  signal?: AbortSignal,
): Promise<Array<{ tag: string; count: number }>> {
  const url = `${REGISTRY_BASE_URL}/api/v1/tags`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Failed to fetch tags: ${resp.status}`);
  const data = (await resp.json()) as unknown;
  const parsed = TagsResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Tags endpoint returned unexpected response shape');
  }
  return parsed.data.tags;
}

/**
 * Fetch the detail view for a specific NodeDef.
 */
export async function fetchNodeDefDetail(
  namespace: string,
  name: string,
  signal?: AbortSignal,
): Promise<RemoteNodeDefDetail> {
  const url = `${REGISTRY_BASE_URL}/api/v1/nodedefs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Failed to fetch NodeDef detail: ${resp.status}`);
  const data = (await resp.json()) as unknown;
  const parsed = RemoteNodeDefDetailSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`NodeDef detail returned unexpected response shape`);
  }
  return parsed.data;
}

/**
 * Fetch the raw YAML for a specific NodeDef version from the registry.
 * Throws on network errors or non-OK HTTP responses.
 */
export async function fetchNodeDefYaml(
  namespace: string,
  name: string,
  version: string,
  signal?: AbortSignal,
): Promise<string> {
  const url =
    `${REGISTRY_BASE_URL}/api/v1/nodedefs/` +
    `${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/yaml`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Failed to fetch NodeDef YAML: ${resp.status}`);
  return resp.text();
}

// ---------------------------------------------------------------------------
// Publish API
// ---------------------------------------------------------------------------

/**
 * Matches the platform's publishBodySchema.
 * blob is the full NodeDef object (stored as JSONB by the registry).
 */
export type PublishPayload = {
  namespace: string;
  name: string;
  displayName: string;
  description: string | null;
  tags: string[];
  version: string;
  blob: Record<string, unknown>;
};

export class PublishError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

/**
 * Publish a NodeDef to the community registry.
 * POST /api/v1/nodedefs — body matches the platform's publishBodySchema.
 * Throws PublishError on non-2xx responses (includes statusCode for caller inspection).
 */
export async function publishNodeDef(
  payload: PublishPayload,
  token: string,
): Promise<void> {
  const url = `${REGISTRY_BASE_URL}/api/v1/nodedefs`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) return;
  let message = `Publish failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body.message) message = body.message;
    else if (body.error) message = body.error;
  } catch {
    // JSON parse failed — use the default message
  }
  throw new PublishError(message, res.status);
}

// ---------------------------------------------------------------------------
// Check Updates API
// ---------------------------------------------------------------------------

const CheckUpdatesResponseSchema = z.object({
  updates: z.array(z.object({
    namespace: z.string(),
    name: z.string(),
    latestVersion: z.string(),
  })),
});

/**
 * Batch-check the registry for latest versions of the given entries.
 * Throws on network errors, non-OK HTTP responses, or unexpected response shape.
 * No download events are recorded.
 */
export async function checkUpdatesRemote(
  entries: { namespace: string; name: string }[],
  signal?: AbortSignal,
): Promise<Array<{ namespace: string; name: string; latestVersion: string }>> {
  const url = `${REGISTRY_BASE_URL}/api/v1/nodedefs/check-updates`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
    signal,
  });
  if (!resp.ok) throw new Error(`check-updates failed: ${resp.status}`);
  const data = (await resp.json()) as unknown;
  const parsed = CheckUpdatesResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error('check-updates returned unexpected shape');
  return parsed.data.updates;
}
