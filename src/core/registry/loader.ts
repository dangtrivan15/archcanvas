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
import cronJobYaml from './builtins/core/compute/cron-job.yaml?raw';
import containerYaml from './builtins/core/compute/container.yaml?raw';

// Data namespace
import databaseYaml from './builtins/core/data/database.yaml?raw';
import cacheYaml from './builtins/core/data/cache.yaml?raw';
import objectStorageYaml from './builtins/core/data/object-storage.yaml?raw';
import repositoryYaml from './builtins/core/data/repository.yaml?raw';
import searchIndexYaml from './builtins/core/data/search-index.yaml?raw';

// Messaging namespace
import messageQueueYaml from './builtins/core/messaging/message-queue.yaml?raw';
import eventBusYaml from './builtins/core/messaging/event-bus.yaml?raw';
import streamProcessorYaml from './builtins/core/messaging/stream-processor.yaml?raw';
import notificationYaml from './builtins/core/messaging/notification.yaml?raw';

// Network namespace
import loadBalancerYaml from './builtins/core/network/load-balancer.yaml?raw';
import cdnYaml from './builtins/core/network/cdn.yaml?raw';

// Observability namespace
import loggingYaml from './builtins/core/observability/logging.yaml?raw';
import monitoringYaml from './builtins/core/observability/monitoring.yaml?raw';
import tracingYaml from './builtins/core/observability/tracing.yaml?raw';

// Security namespace
import authProviderYaml from './builtins/core/security/auth-provider.yaml?raw';
import vaultYaml from './builtins/core/security/vault.yaml?raw';
import wafYaml from './builtins/core/security/waf.yaml?raw';

// Integration namespace
import thirdPartyApiYaml from './builtins/core/integration/third-party-api.yaml?raw';
import webhookYaml from './builtins/core/integration/webhook.yaml?raw';
import etlPipelineYaml from './builtins/core/integration/etl-pipeline.yaml?raw';

// Client namespace
import webAppYaml from './builtins/core/client/web-app.yaml?raw';
import mobileAppYaml from './builtins/core/client/mobile-app.yaml?raw';
import cliYaml from './builtins/core/client/cli.yaml?raw';

// AI namespace
import llmProviderYaml from './builtins/core/ai/llm-provider.yaml?raw';

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
 * All 20 built-in nodedef YAML sources, organized for loading.
 */
export const YAML_SOURCES: YamlNodeDefSource[] = [
  // Compute (4)
  { filePath: 'compute/service.yaml', rawYaml: serviceYaml, namespace: 'compute', name: 'service' },
  { filePath: 'compute/function.yaml', rawYaml: functionYaml, namespace: 'compute', name: 'function' },
  { filePath: 'compute/worker.yaml', rawYaml: workerYaml, namespace: 'compute', name: 'worker' },
  { filePath: 'compute/api-gateway.yaml', rawYaml: apiGatewayYaml, namespace: 'compute', name: 'api-gateway' },
  { filePath: 'compute/cron-job.yaml', rawYaml: cronJobYaml, namespace: 'compute', name: 'cron-job' },
  { filePath: 'compute/container.yaml', rawYaml: containerYaml, namespace: 'compute', name: 'container' },
  // Data (4)
  { filePath: 'data/database.yaml', rawYaml: databaseYaml, namespace: 'data', name: 'database' },
  { filePath: 'data/cache.yaml', rawYaml: cacheYaml, namespace: 'data', name: 'cache' },
  { filePath: 'data/object-storage.yaml', rawYaml: objectStorageYaml, namespace: 'data', name: 'object-storage' },
  { filePath: 'data/repository.yaml', rawYaml: repositoryYaml, namespace: 'data', name: 'repository' },
  { filePath: 'data/search-index.yaml', rawYaml: searchIndexYaml, namespace: 'data', name: 'search-index' },
  // Messaging (3)
  { filePath: 'messaging/message-queue.yaml', rawYaml: messageQueueYaml, namespace: 'messaging', name: 'message-queue' },
  { filePath: 'messaging/event-bus.yaml', rawYaml: eventBusYaml, namespace: 'messaging', name: 'event-bus' },
  { filePath: 'messaging/stream-processor.yaml', rawYaml: streamProcessorYaml, namespace: 'messaging', name: 'stream-processor' },
  { filePath: 'messaging/notification.yaml', rawYaml: notificationYaml, namespace: 'messaging', name: 'notification' },
  // Network (2)
  { filePath: 'network/load-balancer.yaml', rawYaml: loadBalancerYaml, namespace: 'network', name: 'load-balancer' },
  { filePath: 'network/cdn.yaml', rawYaml: cdnYaml, namespace: 'network', name: 'cdn' },
  // Observability (2)
  { filePath: 'observability/logging.yaml', rawYaml: loggingYaml, namespace: 'observability', name: 'logging' },
  { filePath: 'observability/monitoring.yaml', rawYaml: monitoringYaml, namespace: 'observability', name: 'monitoring' },
  { filePath: 'observability/tracing.yaml', rawYaml: tracingYaml, namespace: 'observability', name: 'tracing' },
  // Security (3)
  { filePath: 'security/auth-provider.yaml', rawYaml: authProviderYaml, namespace: 'security', name: 'auth-provider' },
  { filePath: 'security/vault.yaml', rawYaml: vaultYaml, namespace: 'security', name: 'vault' },
  { filePath: 'security/waf.yaml', rawYaml: wafYaml, namespace: 'security', name: 'waf' },
  // Integration (3)
  { filePath: 'integration/third-party-api.yaml', rawYaml: thirdPartyApiYaml, namespace: 'integration', name: 'third-party-api' },
  { filePath: 'integration/webhook.yaml', rawYaml: webhookYaml, namespace: 'integration', name: 'webhook' },
  { filePath: 'integration/etl-pipeline.yaml', rawYaml: etlPipelineYaml, namespace: 'integration', name: 'etl-pipeline' },
  // Client (3)
  { filePath: 'client/web-app.yaml', rawYaml: webAppYaml, namespace: 'client', name: 'web-app' },
  { filePath: 'client/mobile-app.yaml', rawYaml: mobileAppYaml, namespace: 'client', name: 'mobile-app' },
  { filePath: 'client/cli.yaml', rawYaml: cliYaml, namespace: 'client', name: 'cli' },
  // AI (1)
  { filePath: 'ai/llm-provider.yaml', rawYaml: llmProviderYaml, namespace: 'ai', name: 'llm-provider' },
];

/**
 * Parse a raw YAML string into a NodeDef-shaped object.
 * Does NOT validate against Zod schema - use validateNodeDef() for that.
 */
export function parseNodeDefYaml(yamlContent: string): unknown {
  return parseYaml(yamlContent);
}

/**
 * Load all 20 built-in nodedef YAML files and parse them into objects.
 * Returns an array of parsed objects ready for validation.
 */
export function loadAllBuiltinYaml(): NodeDef[] {
  return YAML_SOURCES.map((source) => {
    const parsed = parseNodeDefYaml(source.rawYaml);
    return parsed as NodeDef;
  });
}
