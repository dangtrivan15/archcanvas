/**
 * NodeDef YAML Loader.
 * Loads and parses built-in nodedef YAML files.
 * Uses Vite's ?raw import to get YAML content as strings at build time,
 * then parses with the 'yaml' package at runtime.
 */

import { parse as parseYaml } from 'yaml';
import type { NodeDef } from '@/types/nodedef';

// Import YAML files as raw strings via Vite's ?raw suffix
// Compute namespace
import serviceYaml from './builtins/core/compute/service.yaml?raw';
import functionYaml from './builtins/core/compute/function.yaml?raw';
import workerYaml from './builtins/core/compute/worker.yaml?raw';
import apiGatewayYaml from './builtins/core/compute/api-gateway.yaml?raw';

// Data namespace
import databaseYaml from './builtins/core/data/database.yaml?raw';
import cacheYaml from './builtins/core/data/cache.yaml?raw';
import objectStorageYaml from './builtins/core/data/object-storage.yaml?raw';
import repositoryYaml from './builtins/core/data/repository.yaml?raw';

// Messaging namespace
import messageQueueYaml from './builtins/core/messaging/message-queue.yaml?raw';
import eventBusYaml from './builtins/core/messaging/event-bus.yaml?raw';
import streamProcessorYaml from './builtins/core/messaging/stream-processor.yaml?raw';

// Network namespace
import loadBalancerYaml from './builtins/core/network/load-balancer.yaml?raw';
import cdnYaml from './builtins/core/network/cdn.yaml?raw';

// Observability namespace
import loggingYaml from './builtins/core/observability/logging.yaml?raw';
import monitoringYaml from './builtins/core/observability/monitoring.yaml?raw';

// Security namespace
import authProviderYaml from './builtins/core/security/auth-provider.yaml?raw';

/**
 * Metadata about a YAML nodedef source file.
 */
export interface YamlNodeDefSource {
  /** File path relative to builtins/core/ */
  filePath: string;
  /** Raw YAML content */
  rawYaml: string;
  /** Namespace (e.g., 'compute', 'data') */
  namespace: string;
  /** Name (e.g., 'service', 'database') */
  name: string;
}

/**
 * All 15 built-in nodedef YAML sources, organized for loading.
 */
export const YAML_SOURCES: YamlNodeDefSource[] = [
  // Compute (4)
  { filePath: 'compute/service.yaml', rawYaml: serviceYaml, namespace: 'compute', name: 'service' },
  { filePath: 'compute/function.yaml', rawYaml: functionYaml, namespace: 'compute', name: 'function' },
  { filePath: 'compute/worker.yaml', rawYaml: workerYaml, namespace: 'compute', name: 'worker' },
  { filePath: 'compute/api-gateway.yaml', rawYaml: apiGatewayYaml, namespace: 'compute', name: 'api-gateway' },
  // Data (4)
  { filePath: 'data/database.yaml', rawYaml: databaseYaml, namespace: 'data', name: 'database' },
  { filePath: 'data/cache.yaml', rawYaml: cacheYaml, namespace: 'data', name: 'cache' },
  { filePath: 'data/object-storage.yaml', rawYaml: objectStorageYaml, namespace: 'data', name: 'object-storage' },
  { filePath: 'data/repository.yaml', rawYaml: repositoryYaml, namespace: 'data', name: 'repository' },
  // Messaging (3)
  { filePath: 'messaging/message-queue.yaml', rawYaml: messageQueueYaml, namespace: 'messaging', name: 'message-queue' },
  { filePath: 'messaging/event-bus.yaml', rawYaml: eventBusYaml, namespace: 'messaging', name: 'event-bus' },
  { filePath: 'messaging/stream-processor.yaml', rawYaml: streamProcessorYaml, namespace: 'messaging', name: 'stream-processor' },
  // Network (2)
  { filePath: 'network/load-balancer.yaml', rawYaml: loadBalancerYaml, namespace: 'network', name: 'load-balancer' },
  { filePath: 'network/cdn.yaml', rawYaml: cdnYaml, namespace: 'network', name: 'cdn' },
  // Observability (2)
  { filePath: 'observability/logging.yaml', rawYaml: loggingYaml, namespace: 'observability', name: 'logging' },
  { filePath: 'observability/monitoring.yaml', rawYaml: monitoringYaml, namespace: 'observability', name: 'monitoring' },
  // Security (1)
  { filePath: 'security/auth-provider.yaml', rawYaml: authProviderYaml, namespace: 'security', name: 'auth-provider' },
];

/**
 * Parse a raw YAML string into a NodeDef-shaped object.
 * Does NOT validate against Zod schema - use validateNodeDef() for that.
 */
export function parseNodeDefYaml(yamlContent: string): unknown {
  return parseYaml(yamlContent);
}

/**
 * Load all 15 built-in nodedef YAML files and parse them into objects.
 * Returns an array of parsed objects ready for validation.
 */
export function loadAllBuiltinYaml(): NodeDef[] {
  return YAML_SOURCES.map((source) => {
    const parsed = parseNodeDefYaml(source.rawYaml);
    return parsed as NodeDef;
  });
}
