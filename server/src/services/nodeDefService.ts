import { parseNodeDef } from '@/core/registry/validator';
import type {
  INodeDefRepository,
  IUserRepository,
  SearchFilters,
  Pagination,
  SearchResult,
  NodeDefRecord,
} from '../repositories/types';
import type { MetricsService } from './metricsService';
import { validateSemver } from '../validation/publish';
import {
  ValidationError,
  ForbiddenError,
  VersionConflictError,
} from '../middleware/errorHandler';

export class NodeDefService {
  constructor(
    private nodeDefRepo: INodeDefRepository,
    private userRepo: IUserRepository,
    private metricsService: MetricsService,
  ) {}

  search(
    query: string | null,
    filters: SearchFilters,
    pagination: Pagination,
  ): SearchResult {
    return this.nodeDefRepo.search(query, filters, pagination);
  }

  fetch(
    namespace: string,
    name: string,
    version?: string,
    clientIp?: string,
  ): NodeDefRecord | null {
    const record = this.nodeDefRepo.findByKey(namespace, name, version);

    if (!record) return null;

    // Record download (fire-and-forget)
    const resolvedVersion = version || (record.nodeDef as { metadata?: { version?: string } }).metadata?.version || record.versions[0];
    if (resolvedVersion && clientIp) {
      this.metricsService.recordDownload(record.id, resolvedVersion, clientIp);
    }

    return record;
  }

  publish(
    yamlContent: string,
    userId: number,
  ): { namespace: string; name: string; version: string } {
    // Parse and validate against NodeDef schema
    const result = parseNodeDef(yamlContent);

    if ('error' in result) {
      throw new ValidationError(result.error);
    }

    const { nodeDef } = result;
    const { metadata } = nodeDef;

    // Validate semver
    if (!validateSemver(metadata.version)) {
      throw new ValidationError(
        `Invalid version format: "${metadata.version}". Must be valid semver (MAJOR.MINOR.PATCH).`,
      );
    }

    // Check namespace access
    const access = this.userRepo.checkNamespaceAccess(
      metadata.namespace,
      userId,
    );
    if (!access.allowed) {
      if (access.reason === 'reserved') {
        throw new ForbiddenError(
          `Namespace "${metadata.namespace}" is reserved and cannot be published to.`,
        );
      }
      throw new ForbiddenError(
        `You do not have permission to publish to namespace "${metadata.namespace}".`,
      );
    }

    // Check version doesn't already exist
    if (this.nodeDefRepo.exists(metadata.namespace, metadata.name, metadata.version)) {
      throw new VersionConflictError(
        `Version ${metadata.version} of ${metadata.namespace}/${metadata.name} already exists. Versions are immutable.`,
      );
    }

    // Create namespace if it doesn't exist
    this.userRepo.createNamespace(metadata.namespace, userId);

    // Publish
    this.nodeDefRepo.publish(nodeDef, yamlContent, userId);

    return {
      namespace: metadata.namespace,
      name: metadata.name,
      version: metadata.version,
    };
  }
}
