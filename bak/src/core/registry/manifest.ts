/**
 * NodeDef Manifest — single source of truth for all built-in YAML files.
 *
 * Both the web loader (loader.ts, Vite ?raw) and CLI loader (nodeLoader.ts, fs)
 * derive their file lists from this manifest. Adding a new built-in nodedef
 * requires adding an entry here + a ?raw import in loader.ts.
 *
 * This file has zero imports and zero runtime dependencies so it can be
 * consumed by any environment (browser, Node.js, tests).
 */

/** Metadata for a built-in NodeDef YAML file. */
export interface NodeDefManifestEntry {
  /** Relative path from builtins/core/, e.g. "compute/service.yaml" */
  filePath: string;
  /** Namespace, e.g. "compute" */
  namespace: string;
  /** Name, e.g. "service" */
  name: string;
}

/**
 * All 42 built-in NodeDef YAML files.
 * Organized by namespace in alphabetical order.
 */
export const NODEDEF_MANIFEST: NodeDefManifestEntry[] = [
  // AI (8)
  { filePath: 'ai/agent.yaml', namespace: 'ai', name: 'agent' },
  { filePath: 'ai/embedding-service.yaml', namespace: 'ai', name: 'embedding-service' },
  { filePath: 'ai/guardrails.yaml', namespace: 'ai', name: 'guardrails' },
  { filePath: 'ai/llm-provider.yaml', namespace: 'ai', name: 'llm-provider' },
  { filePath: 'ai/model-serving.yaml', namespace: 'ai', name: 'model-serving' },
  { filePath: 'ai/prompt-registry.yaml', namespace: 'ai', name: 'prompt-registry' },
  { filePath: 'ai/rag-pipeline.yaml', namespace: 'ai', name: 'rag-pipeline' },
  { filePath: 'ai/vector-store.yaml', namespace: 'ai', name: 'vector-store' },

  // Client (3)
  { filePath: 'client/cli.yaml', namespace: 'client', name: 'cli' },
  { filePath: 'client/mobile-app.yaml', namespace: 'client', name: 'mobile-app' },
  { filePath: 'client/web-app.yaml', namespace: 'client', name: 'web-app' },

  // Compute (6)
  { filePath: 'compute/api-gateway.yaml', namespace: 'compute', name: 'api-gateway' },
  { filePath: 'compute/container.yaml', namespace: 'compute', name: 'container' },
  { filePath: 'compute/cron-job.yaml', namespace: 'compute', name: 'cron-job' },
  { filePath: 'compute/function.yaml', namespace: 'compute', name: 'function' },
  { filePath: 'compute/service.yaml', namespace: 'compute', name: 'service' },
  { filePath: 'compute/worker.yaml', namespace: 'compute', name: 'worker' },

  // Data (7)
  { filePath: 'data/cache.yaml', namespace: 'data', name: 'cache' },
  { filePath: 'data/database.yaml', namespace: 'data', name: 'database' },
  { filePath: 'data/feature-store.yaml', namespace: 'data', name: 'feature-store' },
  { filePath: 'data/graph-database.yaml', namespace: 'data', name: 'graph-database' },
  { filePath: 'data/object-storage.yaml', namespace: 'data', name: 'object-storage' },
  { filePath: 'data/repository.yaml', namespace: 'data', name: 'repository' },
  { filePath: 'data/search-index.yaml', namespace: 'data', name: 'search-index' },

  // Integration (4)
  { filePath: 'integration/etl-pipeline.yaml', namespace: 'integration', name: 'etl-pipeline' },
  { filePath: 'integration/mcp-server.yaml', namespace: 'integration', name: 'mcp-server' },
  {
    filePath: 'integration/third-party-api.yaml',
    namespace: 'integration',
    name: 'third-party-api',
  },
  { filePath: 'integration/webhook.yaml', namespace: 'integration', name: 'webhook' },

  // Messaging (4)
  { filePath: 'messaging/event-bus.yaml', namespace: 'messaging', name: 'event-bus' },
  { filePath: 'messaging/message-queue.yaml', namespace: 'messaging', name: 'message-queue' },
  { filePath: 'messaging/notification.yaml', namespace: 'messaging', name: 'notification' },
  {
    filePath: 'messaging/stream-processor.yaml',
    namespace: 'messaging',
    name: 'stream-processor',
  },

  // Meta (1)
  { filePath: 'meta/canvas-ref.yaml', namespace: 'meta', name: 'canvas-ref' },

  // Network (2)
  { filePath: 'network/cdn.yaml', namespace: 'network', name: 'cdn' },
  { filePath: 'network/load-balancer.yaml', namespace: 'network', name: 'load-balancer' },

  // Observability (4)
  { filePath: 'observability/llm-monitor.yaml', namespace: 'observability', name: 'llm-monitor' },
  { filePath: 'observability/logging.yaml', namespace: 'observability', name: 'logging' },
  { filePath: 'observability/monitoring.yaml', namespace: 'observability', name: 'monitoring' },
  { filePath: 'observability/tracing.yaml', namespace: 'observability', name: 'tracing' },

  // Security (3)
  {
    filePath: 'security/auth-provider.yaml',
    namespace: 'security',
    name: 'auth-provider',
  },
  { filePath: 'security/vault.yaml', namespace: 'security', name: 'vault' },
  { filePath: 'security/waf.yaml', namespace: 'security', name: 'waf' },
];
