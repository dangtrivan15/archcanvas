import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeDefService } from '../../../src/services/nodeDefService';
import type {
  INodeDefRepository,
  IUserRepository,
  SearchResult,
  NodeDefRecord,
} from '../../../src/repositories/types';
import { MetricsService } from '../../../src/services/metricsService';
import type { IMetricsRepository } from '../../../src/repositories/types';
import {
  ValidationError,
  ForbiddenError,
  VersionConflictError,
} from '../../../src/middleware/errorHandler';

const VALID_YAML = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test-node
  namespace: testns
  version: "1.0.0"
  displayName: Test Node
  description: "A test node."
  icon: Box
  tags: [test]
  shape: rectangle
spec:
  args: []
`;

function createMockNodeDefRepo(): INodeDefRepository {
  return {
    search: vi.fn().mockReturnValue({ items: [], total: 0 } as SearchResult),
    findByKey: vi.fn().mockReturnValue(null),
    publish: vi.fn().mockReturnValue({ id: 1 }),
    listVersions: vi.fn().mockReturnValue([]),
    exists: vi.fn().mockReturnValue(false),
  };
}

function createMockUserRepo(): IUserRepository {
  return {
    upsertFromGitHub: vi.fn(),
    findById: vi.fn(),
    findByGitHubId: vi.fn(),
    checkNamespaceAccess: vi.fn().mockReturnValue({ allowed: true }),
    createNamespace: vi.fn(),
  };
}

function createMockMetricsRepo(): IMetricsRepository {
  return {
    incrementDownload: vi.fn(),
    getDownloadStats: vi.fn().mockReturnValue({ total: 0, byVersion: {} }),
    getTrending: vi.fn().mockReturnValue([]),
  };
}

describe('NodeDefService', () => {
  let nodeDefRepo: INodeDefRepository;
  let userRepo: IUserRepository;
  let metricsService: MetricsService;
  let svc: NodeDefService;

  beforeEach(() => {
    nodeDefRepo = createMockNodeDefRepo();
    userRepo = createMockUserRepo();
    metricsService = new MetricsService(createMockMetricsRepo());
    svc = new NodeDefService(nodeDefRepo, userRepo, metricsService);
  });

  describe('publish', () => {
    it('publishes valid NodeDef YAML', () => {
      const result = svc.publish(VALID_YAML, 1);
      expect(result).toEqual({
        namespace: 'testns',
        name: 'test-node',
        version: '1.0.0',
      });
      expect(nodeDefRepo.publish).toHaveBeenCalledOnce();
      expect(userRepo.createNamespace).toHaveBeenCalledWith('testns', 1);
    });

    it('throws ValidationError for invalid YAML', () => {
      expect(() => svc.publish('not: valid: yaml: [', 1)).toThrow(
        ValidationError,
      );
    });

    it('throws ValidationError for missing required fields', () => {
      const invalidYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: test
  namespace: test
spec: {}
`;
      expect(() => svc.publish(invalidYaml, 1)).toThrow(ValidationError);
    });

    it('throws ValidationError for invalid semver', () => {
      const yaml = VALID_YAML.replace('version: "1.0.0"', 'version: "latest"');
      expect(() => svc.publish(yaml, 1)).toThrow(ValidationError);
    });

    it('throws ForbiddenError for reserved namespace', () => {
      vi.mocked(userRepo.checkNamespaceAccess).mockReturnValue({
        allowed: false,
        reason: 'reserved',
      });
      const yaml = VALID_YAML.replace(
        'namespace: testns',
        'namespace: compute',
      );
      expect(() => svc.publish(yaml, 1)).toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for non-owner namespace', () => {
      vi.mocked(userRepo.checkNamespaceAccess).mockReturnValue({
        allowed: false,
        reason: 'not_owner',
      });
      expect(() => svc.publish(VALID_YAML, 2)).toThrow(ForbiddenError);
    });

    it('throws VersionConflictError for duplicate version', () => {
      vi.mocked(nodeDefRepo.exists).mockReturnValue(true);
      expect(() => svc.publish(VALID_YAML, 1)).toThrow(VersionConflictError);
    });
  });

  describe('search', () => {
    it('delegates to repository', () => {
      svc.search('test', {}, { page: 1, pageSize: 20, sort: 'relevance' });
      expect(nodeDefRepo.search).toHaveBeenCalledWith(
        'test',
        {},
        { page: 1, pageSize: 20, sort: 'relevance' },
      );
    });
  });

  describe('fetch', () => {
    it('returns null for non-existent NodeDef', () => {
      const result = svc.fetch('ns', 'name');
      expect(result).toBeNull();
    });

    it('returns record for existing NodeDef', () => {
      const mockRecord: NodeDefRecord = {
        id: 1,
        nodeDef: { kind: 'NodeDef', apiVersion: 'v1', metadata: { version: '1.0.0' }, spec: {} },
        yamlBlob: 'yaml content',
        publisher: { username: 'test', avatarUrl: null },
        versions: ['1.0.0'],
        downloads: { total: 0, thisVersion: 0 },
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      vi.mocked(nodeDefRepo.findByKey).mockReturnValue(mockRecord);

      const result = svc.fetch('ns', 'name', undefined, '127.0.0.1');
      expect(result).toBe(mockRecord);
    });
  });
});
