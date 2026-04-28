// ---------------------------------------------------------------------------
// Remote Registry API client
// All network calls to registry.archcanvas.dev are isolated here.
// ---------------------------------------------------------------------------

import { z } from 'zod/v4';

const RemoteNodeDefSummarySchema = z.object({
  namespace: z.string(),
  name: z.string(),
  version: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
});

export type RemoteNodeDefSummary = z.infer<typeof RemoteNodeDefSummarySchema>;

const RemoteNodeDefSummaryArraySchema = z.array(RemoteNodeDefSummarySchema);

export const REGISTRY_BASE_URL = 'https://registry.archcanvas.dev';

/**
 * Search the community registry for NodeDefs matching the given query.
 * Throws on network errors, non-OK HTTP responses, or AbortError (signal cancelled).
 */
export async function searchRegistry(
  query: string,
  signal?: AbortSignal,
): Promise<RemoteNodeDefSummary[]> {
  const url = `${REGISTRY_BASE_URL}/api/v1/search?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Registry search failed: ${resp.status}`);
  const data = (await resp.json()) as unknown;
  // Normalise: the registry may return an array directly or { results: [...] }
  const raw = Array.isArray(data) ? data : ((data as { results?: unknown }).results ?? []);
  const parsed = RemoteNodeDefSummaryArraySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Registry returned unexpected response shape`);
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
