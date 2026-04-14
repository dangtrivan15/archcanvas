import type { NodeDef } from '@/types/nodeDefSchema';

export interface SearchFilters {
  namespace?: string;
  tags?: string[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  sort: 'relevance' | 'recent' | 'popular' | 'name';
}

export interface SearchResultItem {
  namespace: string;
  name: string;
  version: string;
  displayName: string;
  description: string;
  icon: string;
  tags: string[];
  shape: string;
  publisher: { username: string; avatarUrl: string | null };
  downloads: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
}

export interface NodeDefRecord {
  id: number;
  nodeDef: object;
  yamlBlob: string;
  publisher: { username: string; avatarUrl: string | null };
  versions: string[];
  downloads: { total: number; thisVersion: number };
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: number;
  githubId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface INodeDefRepository {
  search(
    query: string | null,
    filters: SearchFilters,
    pagination: Pagination,
  ): SearchResult;
  findByKey(
    namespace: string,
    name: string,
    version?: string,
  ): NodeDefRecord | null;
  publish(
    nodeDef: NodeDef,
    yamlBlob: string,
    userId: number,
  ): { id: number };
  listVersions(namespace: string, name: string): string[];
  exists(namespace: string, name: string, version: string): boolean;
}

export interface IUserRepository {
  upsertFromGitHub(
    githubId: number,
    username: string,
    displayName: string | null,
    avatarUrl: string | null,
  ): UserRecord;
  findById(id: number): UserRecord | null;
  findByGitHubId(githubId: number): UserRecord | null;
  checkNamespaceAccess(
    namespace: string,
    userId: number,
  ): { allowed: boolean; reason?: string };
  createNamespace(name: string, ownerId: number): void;
}

export interface ApiTokenRecord {
  id: number;
  userId: number;
  tokenHash: string;
  prefix: string;
}

export interface IApiTokenRepository {
  findByPrefix(prefix: string): ApiTokenRecord[];
  create(userId: number, name: string, tokenHash: string, prefix: string): void;
  updateLastUsed(tokenId: number): void;
  deleteByIdAndUser(tokenId: number, userId: number): boolean;
}

export interface IMetricsRepository {
  incrementDownload(nodedefId: number, version: string, day: string): void;
  getDownloadStats(
    nodedefId: number,
  ): { total: number; byVersion: Record<string, number> };
  getTrending(
    days: number,
    limit: number,
  ): Array<{ nodedefId: number; downloads: number }>;
}
