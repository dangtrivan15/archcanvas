// ---------------------------------------------------------------------------
// Remote Registry API client
// All network calls to registry.archcanvas.dev are isolated here.
// ---------------------------------------------------------------------------

export interface RemoteNodeDefSummary {
  namespace: string;
  name: string;
  version: string;
  displayName?: string;
  description?: string;
}

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
  const data = await resp.json() as unknown;
  // Normalise: the registry may return an array directly or { results: [...] }
  return Array.isArray(data)
    ? (data as RemoteNodeDefSummary[])
    : (((data as { results?: RemoteNodeDefSummary[] }).results) ?? []);
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
  const url = `${REGISTRY_BASE_URL}/api/v1/nodedefs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/yaml`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Failed to fetch NodeDef YAML: ${resp.status}`);
  return resp.text();
}
