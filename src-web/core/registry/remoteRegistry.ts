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

export const REGISTRY_BASE_URL = 'https://registry.archcanvas.dev';

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
  opts: { q?: string; namespace?: string; page?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<{ items: RemoteNodeDefSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.namespace) params.set('namespace', opts.namespace);
  if (opts.page !== undefined) params.set('page', String(opts.page));
  if (opts.pageSize !== undefined) params.set('pageSize', String(opts.pageSize));
  const url = `${REGISTRY_BASE_URL}/api/v1/nodedefs${params.toString() ? '?' + params.toString() : ''}`;
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
  const data = (await resp.json()) as { namespaces: Array<{ namespace: string; count: number }> };
  return data.namespaces;
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
