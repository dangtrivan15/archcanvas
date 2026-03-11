/**
 * NodeDef YAML Loader.
 * Loads and parses built-in nodedef YAML files.
 * Uses Vite's ?raw import to get YAML content as strings at build time,
 * then parses with the 'yaml' package at runtime.
 *
 * The file list is driven by NODEDEF_MANIFEST — the single source of truth
 * shared with the CLI loader. Adding a new builtin YAML requires:
 *   1. Add an entry to manifest.ts
 *   2. Add a ?raw import below + an entry in RAW_YAML_MAP
 */

import { parse as parseYaml } from 'yaml';
import type { NodeDef } from '@/types/nodedef';
import { NODEDEF_MANIFEST } from './manifest';

// ── ?raw YAML imports (static, required by Vite/esbuild) ──────────────

// AI namespace
import agentYaml from './builtins/core/ai/agent.yaml?raw';
import embeddingServiceYaml from './builtins/core/ai/embedding-service.yaml?raw';
import guardrailsYaml from './builtins/core/ai/guardrails.yaml?raw';
import llmProviderYaml from './builtins/core/ai/llm-provider.yaml?raw';
import modelServingYaml from './builtins/core/ai/model-serving.yaml?raw';
import promptRegistryYaml from './builtins/core/ai/prompt-registry.yaml?raw';
import ragPipelineYaml from './builtins/core/ai/rag-pipeline.yaml?raw';
import vectorStoreYaml from './builtins/core/ai/vector-store.yaml?raw';

// Client namespace
import cliYaml from './builtins/core/client/cli.yaml?raw';
import mobileAppYaml from './builtins/core/client/mobile-app.yaml?raw';
import webAppYaml from './builtins/core/client/web-app.yaml?raw';

// Compute namespace
import apiGatewayYaml from './builtins/core/compute/api-gateway.yaml?raw';
import containerYaml from './builtins/core/compute/container.yaml?raw';
import cronJobYaml from './builtins/core/compute/cron-job.yaml?raw';
import functionYaml from './builtins/core/compute/function.yaml?raw';
import serviceYaml from './builtins/core/compute/service.yaml?raw';
import workerYaml from './builtins/core/compute/worker.yaml?raw';

// Data namespace
import cacheYaml from './builtins/core/data/cache.yaml?raw';
import databaseYaml from './builtins/core/data/database.yaml?raw';
import featureStoreYaml from './builtins/core/data/feature-store.yaml?raw';
import graphDatabaseYaml from './builtins/core/data/graph-database.yaml?raw';
import objectStorageYaml from './builtins/core/data/object-storage.yaml?raw';
import repositoryYaml from './builtins/core/data/repository.yaml?raw';
import searchIndexYaml from './builtins/core/data/search-index.yaml?raw';

// Integration namespace
import etlPipelineYaml from './builtins/core/integration/etl-pipeline.yaml?raw';
import mcpServerYaml from './builtins/core/integration/mcp-server.yaml?raw';
import thirdPartyApiYaml from './builtins/core/integration/third-party-api.yaml?raw';
import webhookYaml from './builtins/core/integration/webhook.yaml?raw';

// Messaging namespace
import eventBusYaml from './builtins/core/messaging/event-bus.yaml?raw';
import messageQueueYaml from './builtins/core/messaging/message-queue.yaml?raw';
import notificationYaml from './builtins/core/messaging/notification.yaml?raw';
import streamProcessorYaml from './builtins/core/messaging/stream-processor.yaml?raw';

// Meta namespace
import canvasRefYaml from './builtins/core/meta/canvas-ref.yaml?raw';

// Network namespace
import cdnYaml from './builtins/core/network/cdn.yaml?raw';
import loadBalancerYaml from './builtins/core/network/load-balancer.yaml?raw';

// Observability namespace
import llmMonitorYaml from './builtins/core/observability/llm-monitor.yaml?raw';
import loggingYaml from './builtins/core/observability/logging.yaml?raw';
import monitoringYaml from './builtins/core/observability/monitoring.yaml?raw';
import tracingYaml from './builtins/core/observability/tracing.yaml?raw';

// Security namespace
import authProviderYaml from './builtins/core/security/auth-provider.yaml?raw';
import vaultYaml from './builtins/core/security/vault.yaml?raw';
import wafYaml from './builtins/core/security/waf.yaml?raw';

// ── Map manifest filePaths to their ?raw import values ─────────────────

/**
 * Maps each manifest filePath to the corresponding ?raw import.
 * Must be kept in sync with NODEDEF_MANIFEST — a missing entry here
 * causes a loud runtime error on startup.
 */
const RAW_YAML_MAP: Record<string, string> = {
  // AI
  'ai/agent.yaml': agentYaml,
  'ai/embedding-service.yaml': embeddingServiceYaml,
  'ai/guardrails.yaml': guardrailsYaml,
  'ai/llm-provider.yaml': llmProviderYaml,
  'ai/model-serving.yaml': modelServingYaml,
  'ai/prompt-registry.yaml': promptRegistryYaml,
  'ai/rag-pipeline.yaml': ragPipelineYaml,
  'ai/vector-store.yaml': vectorStoreYaml,
  // Client
  'client/cli.yaml': cliYaml,
  'client/mobile-app.yaml': mobileAppYaml,
  'client/web-app.yaml': webAppYaml,
  // Compute
  'compute/api-gateway.yaml': apiGatewayYaml,
  'compute/container.yaml': containerYaml,
  'compute/cron-job.yaml': cronJobYaml,
  'compute/function.yaml': functionYaml,
  'compute/service.yaml': serviceYaml,
  'compute/worker.yaml': workerYaml,
  // Data
  'data/cache.yaml': cacheYaml,
  'data/database.yaml': databaseYaml,
  'data/feature-store.yaml': featureStoreYaml,
  'data/graph-database.yaml': graphDatabaseYaml,
  'data/object-storage.yaml': objectStorageYaml,
  'data/repository.yaml': repositoryYaml,
  'data/search-index.yaml': searchIndexYaml,
  // Integration
  'integration/etl-pipeline.yaml': etlPipelineYaml,
  'integration/mcp-server.yaml': mcpServerYaml,
  'integration/third-party-api.yaml': thirdPartyApiYaml,
  'integration/webhook.yaml': webhookYaml,
  // Messaging
  'messaging/event-bus.yaml': eventBusYaml,
  'messaging/message-queue.yaml': messageQueueYaml,
  'messaging/notification.yaml': notificationYaml,
  'messaging/stream-processor.yaml': streamProcessorYaml,
  // Meta
  'meta/canvas-ref.yaml': canvasRefYaml,
  // Network
  'network/cdn.yaml': cdnYaml,
  'network/load-balancer.yaml': loadBalancerYaml,
  // Observability
  'observability/llm-monitor.yaml': llmMonitorYaml,
  'observability/logging.yaml': loggingYaml,
  'observability/monitoring.yaml': monitoringYaml,
  'observability/tracing.yaml': tracingYaml,
  // Security
  'security/auth-provider.yaml': authProviderYaml,
  'security/vault.yaml': vaultYaml,
  'security/waf.yaml': wafYaml,
};

// ── Public API ─────────────────────────────────────────────────────────

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
 * All 42 built-in nodedef YAML sources, derived from the shared manifest.
 * Each entry's rawYaml is resolved from the ?raw import map.
 */
export const YAML_SOURCES: YamlNodeDefSource[] = NODEDEF_MANIFEST.map((entry) => {
  const rawYaml = RAW_YAML_MAP[entry.filePath];
  if (!rawYaml) {
    throw new Error(
      `[loader] No ?raw import found for manifest entry: ${entry.filePath}. ` +
        `Add the import to loader.ts and map it in RAW_YAML_MAP.`,
    );
  }
  return {
    filePath: entry.filePath,
    rawYaml,
    namespace: entry.namespace,
    name: entry.name,
  };
});

/**
 * Parse a raw YAML string into a NodeDef-shaped object.
 * Does NOT validate against Zod schema - use validateNodeDef() for that.
 */
export function parseNodeDefYaml(yamlContent: string): unknown {
  return parseYaml(yamlContent);
}

/**
 * Load all 42 built-in nodedef YAML files and parse them into objects.
 * Returns an array of parsed objects ready for validation.
 */
export function loadAllBuiltinYaml(): NodeDef[] {
  return YAML_SOURCES.map((source) => {
    const parsed = parseNodeDefYaml(source.rawYaml);
    return parsed as NodeDef;
  });
}
