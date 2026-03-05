/**
 * Inference Result to ArchCanvas Graph Builder
 *
 * Converts the structured AI inference output into actual ArchCanvas graph
 * operations using the existing Text API. Creates nodes with proper types and
 * args, establishes edges with correct types, attaches code references linking
 * nodes back to source files, and adds AI-generated notes.
 *
 * Handles the mapping from AI-inferred component types to the built-in
 * nodedef registry types.
 */

import type { TextApi } from '@/api/textApi';
import type { RegistryManagerCore } from '@/core/registry/registryCore';
import type { InferenceResult, InferredNode, InferredEdge, InferredCodeRef } from './inferEngine';
import type { ArchNode, ArchGraph, CodeRefRole } from '@/types/graph';
import type { AddEdgeParams } from '@/types/api';
import { computeElkLayout } from '@/core/layout/elkLayout';

// ── Types ────────────────────────────────────────────────────────────────────

/** Options for the graph builder */
export interface BuildGraphOptions {
  /** Whether to apply auto-layout using ELK after building the graph (default: true) */
  autoLayout?: boolean;
  /** Layout direction (default: 'horizontal') */
  layoutDirection?: 'horizontal' | 'vertical';
  /** Author name for AI-generated notes (default: 'ai-analyzer') */
  noteAuthor?: string;
  /** Whether to add description notes to nodes (default: true) */
  addDescriptionNotes?: boolean;
}

/** Result returned by buildGraph */
export interface BuildResult {
  /** Number of top-level + child nodes created */
  nodesCreated: number;
  /** Number of edges created */
  edgesCreated: number;
  /** Number of code references attached */
  codeRefsAttached: number;
  /** Warnings encountered during graph building */
  warnings: string[];
  /** Map of inference node IDs to actual ArchCanvas node IDs */
  nodeIdMap: Map<string, string>;
}

// ── Type Mapping ─────────────────────────────────────────────────────────────

/**
 * Fallback type mapping for AI-inferred types that don't exactly match
 * the built-in registry. Maps common synonyms to registry types.
 */
const TYPE_FALLBACK_MAP: Record<string, string> = {
  // Compute synonyms
  'microservice': 'compute/service',
  'service': 'compute/service',
  'api': 'compute/service',
  'api-server': 'compute/service',
  'backend': 'compute/service',
  'server': 'compute/service',
  'rest-api': 'compute/service',
  'grpc-service': 'compute/service',
  'graphql-server': 'compute/service',
  'web-server': 'compute/service',
  'function': 'compute/function',
  'lambda': 'compute/function',
  'serverless': 'compute/function',
  'cloud-function': 'compute/function',
  'worker': 'compute/worker',
  'background-worker': 'compute/worker',
  'job-processor': 'compute/worker',
  'consumer': 'compute/worker',
  'api-gateway': 'compute/api-gateway',
  'gateway': 'compute/api-gateway',
  'reverse-proxy': 'compute/api-gateway',
  'proxy': 'compute/api-gateway',
  'cron-job': 'compute/cron-job',
  'cron': 'compute/cron-job',
  'scheduler': 'compute/cron-job',
  'scheduled-task': 'compute/cron-job',
  'container': 'compute/container',
  'docker': 'compute/container',
  'kubernetes': 'compute/container',
  'k8s': 'compute/container',

  // Data synonyms
  'database': 'data/database',
  'db': 'data/database',
  'relational-database': 'data/database',
  'sql-database': 'data/database',
  'nosql-database': 'data/database',
  'postgres': 'data/database',
  'postgresql': 'data/database',
  'mysql': 'data/database',
  'mongodb': 'data/database',
  'dynamodb': 'data/database',
  'cache': 'data/cache',
  'redis': 'data/cache',
  'memcached': 'data/cache',
  'in-memory-cache': 'data/cache',
  'object-storage': 'data/object-storage',
  'blob-storage': 'data/object-storage',
  's3': 'data/object-storage',
  'gcs': 'data/object-storage',
  'file-storage': 'data/object-storage',
  'storage': 'data/object-storage',
  'repository': 'data/repository',
  'artifact-repository': 'data/repository',
  'search-index': 'data/search-index',
  'search': 'data/search-index',
  'elasticsearch': 'data/search-index',
  'graph-database': 'data/graph-database',
  'neo4j': 'data/graph-database',
  'feature-store': 'data/feature-store',

  // Messaging synonyms
  'message-queue': 'messaging/message-queue',
  'queue': 'messaging/message-queue',
  'mq': 'messaging/message-queue',
  'rabbitmq': 'messaging/message-queue',
  'sqs': 'messaging/message-queue',
  'event-bus': 'messaging/event-bus',
  'pubsub': 'messaging/event-bus',
  'pub-sub': 'messaging/event-bus',
  'kafka': 'messaging/event-bus',
  'sns': 'messaging/event-bus',
  'event-stream': 'messaging/event-bus',
  'stream-processor': 'messaging/stream-processor',
  'flink': 'messaging/stream-processor',
  'kinesis': 'messaging/stream-processor',
  'notification': 'messaging/notification',
  'push-notification': 'messaging/notification',

  // Network synonyms
  'load-balancer': 'network/load-balancer',
  'lb': 'network/load-balancer',
  'elb': 'network/load-balancer',
  'alb': 'network/load-balancer',
  'cdn': 'network/cdn',
  'cloudfront': 'network/cdn',
  'cloudflare': 'network/cdn',

  // Observability synonyms
  'logging': 'observability/logging',
  'log-aggregator': 'observability/logging',
  'elk': 'observability/logging',
  'monitoring': 'observability/monitoring',
  'metrics': 'observability/monitoring',
  'prometheus': 'observability/monitoring',
  'datadog': 'observability/monitoring',
  'grafana': 'observability/monitoring',
  'tracing': 'observability/tracing',
  'jaeger': 'observability/tracing',
  'llm-monitor': 'observability/llm-monitor',

  // Security synonyms
  'auth-provider': 'security/auth-provider',
  'auth': 'security/auth-provider',
  'identity-provider': 'security/auth-provider',
  'idp': 'security/auth-provider',
  'oauth': 'security/auth-provider',
  'vault': 'security/vault',
  'secret-manager': 'security/vault',
  'secrets': 'security/vault',
  'waf': 'security/waf',
  'firewall': 'security/waf',

  // Integration synonyms
  'third-party-api': 'integration/third-party-api',
  'external-api': 'integration/third-party-api',
  'saas': 'integration/third-party-api',
  'webhook': 'integration/webhook',
  'webhooks': 'integration/webhook',
  'etl-pipeline': 'integration/etl-pipeline',
  'etl': 'integration/etl-pipeline',
  'data-pipeline': 'integration/etl-pipeline',
  'mcp-server': 'integration/mcp-server',

  // Client synonyms
  'web-app': 'client/web-app',
  'frontend': 'client/web-app',
  'spa': 'client/web-app',
  'webapp': 'client/web-app',
  'website': 'client/web-app',
  'mobile-app': 'client/mobile-app',
  'mobile': 'client/mobile-app',
  'ios': 'client/mobile-app',
  'android': 'client/mobile-app',
  'cli': 'client/cli',
  'command-line': 'client/cli',

  // AI synonyms
  'llm-provider': 'ai/llm-provider',
  'llm': 'ai/llm-provider',
  'ai-model': 'ai/llm-provider',
  'embedding-service': 'ai/embedding-service',
  'embeddings': 'ai/embedding-service',
  'vector-store': 'ai/vector-store',
  'vector-db': 'ai/vector-store',
  'rag-pipeline': 'ai/rag-pipeline',
  'rag': 'ai/rag-pipeline',
  'agent': 'ai/agent',
  'ai-agent': 'ai/agent',
  'prompt-registry': 'ai/prompt-registry',
  'model-serving': 'ai/model-serving',
  'guardrails': 'ai/guardrails',
};

/**
 * Resolve an AI-inferred node type to a valid registry type.
 *
 * Resolution order:
 * 1. If already a valid namespace/name format and exists in registry, use it
 * 2. Try prepending common namespaces to find a match
 * 3. Use the fallback map for known synonyms
 * 4. Default to 'compute/service' as ultimate fallback
 */
export function resolveNodeType(
  inferredType: string,
  registry: RegistryManagerCore,
): { resolvedType: string; warning?: string } {
  const normalized = inferredType.toLowerCase().trim();

  // 1. If it's already a namespace/name format, try direct resolution
  if (normalized.includes('/')) {
    if (registry.resolve(normalized)) {
      return { resolvedType: normalized };
    }
    // Try the exact inferred type (might be mixed case)
    if (registry.resolve(inferredType)) {
      return { resolvedType: inferredType };
    }
  }

  // 2. Try prepending common namespaces
  const namespaces = registry.listNamespaces();
  for (const ns of namespaces) {
    const candidate = `${ns}/${normalized}`;
    if (registry.resolve(candidate)) {
      return { resolvedType: candidate };
    }
  }

  // 3. Use fallback map
  if (TYPE_FALLBACK_MAP[normalized]) {
    const fallback = TYPE_FALLBACK_MAP[normalized];
    if (registry.resolve(fallback)) {
      return { resolvedType: fallback };
    }
    // Even if not in registry, trust the fallback mapping
    return {
      resolvedType: fallback,
      warning: `Type '${inferredType}' mapped to '${fallback}' via fallback (not in registry)`,
    };
  }

  // 4. Ultimate fallback to compute/service
  return {
    resolvedType: 'compute/service',
    warning: `Unknown type '${inferredType}' defaulted to 'compute/service'`,
  };
}

// ── Edge Type Mapping ────────────────────────────────────────────────────────

/**
 * Map AI edge type (uppercase) to TextApi edge type (lowercase kebab).
 */
function mapEdgeType(aiType: string): AddEdgeParams['type'] {
  switch (aiType.toUpperCase()) {
    case 'SYNC':
      return 'sync';
    case 'ASYNC':
      return 'async';
    case 'DATA_FLOW':
      return 'data-flow';
    default:
      return 'sync';
  }
}

// ── CodeRef Role Mapping ─────────────────────────────────────────────────────

/**
 * Map AI code ref role (uppercase) to ArchCanvas role (lowercase kebab).
 */
function mapCodeRefRole(aiRole: string): CodeRefRole {
  const roleMap: Record<string, CodeRefRole> = {
    'SOURCE': 'source',
    'API_SPEC': 'api-spec',
    'SCHEMA': 'schema',
    'DEPLOYMENT': 'deployment',
    'CONFIG': 'config',
    'TEST': 'test',
  };
  return roleMap[aiRole.toUpperCase()] ?? 'source';
}

// ── Graph Builder ────────────────────────────────────────────────────────────

/**
 * Build an ArchCanvas graph from an AI inference result.
 *
 * This function:
 * 1. Maps AI-inferred node types to built-in registry types
 * 2. Creates nodes via textApi.addNode() with type, displayName, and args
 * 3. Creates nested/child nodes for hierarchical structures
 * 4. Creates edges via textApi.addEdge() mapping AI edge types
 * 5. Attaches code references via textApi.addCodeRef()
 * 6. Adds AI-generated notes to nodes via textApi.addNote()
 * 7. Applies auto-layout positions using elkjs
 * 8. Returns a BuildResult with counts and warnings
 *
 * @param inferenceResult - The structured AI inference output
 * @param textApi - The Text API instance to build the graph through
 * @param registry - The registry manager to resolve node types
 * @param options - Build options
 * @returns BuildResult with node/edge/codeRef counts and warnings
 */
export async function buildGraph(
  inferenceResult: InferenceResult,
  textApi: TextApi,
  registry: RegistryManagerCore,
  options: BuildGraphOptions = {},
): Promise<BuildResult> {
  const {
    autoLayout = true,
    layoutDirection = 'horizontal',
    noteAuthor = 'ai-analyzer',
    addDescriptionNotes = true,
  } = options;

  const result: BuildResult = {
    nodesCreated: 0,
    edgesCreated: 0,
    codeRefsAttached: 0,
    warnings: [],
    nodeIdMap: new Map(),
  };

  // Set architecture name and description
  const graph = textApi.getGraph();
  textApi.setGraph({
    ...graph,
    name: inferenceResult.architectureName,
    description: inferenceResult.architectureDescription,
  });

  // Phase 1: Create all nodes (including children)
  for (const inferredNode of inferenceResult.nodes) {
    createNodeRecursive(inferredNode, undefined, textApi, registry, result, {
      noteAuthor,
      addDescriptionNotes,
    });
  }

  // Phase 2: Create all edges
  for (const inferredEdge of inferenceResult.edges) {
    createEdge(inferredEdge, textApi, result);
  }

  // Phase 3: Apply auto-layout
  if (autoLayout && result.nodesCreated > 0) {
    try {
      const currentGraph = textApi.getGraph();
      const { positions } = await computeElkLayout(
        currentGraph.nodes,
        currentGraph.edges,
        layoutDirection,
      );

      // Apply computed positions to the graph
      const updatedNodes = currentGraph.nodes.map((node) => {
        const pos = positions.get(node.id);
        if (pos) {
          return {
            ...node,
            position: { ...node.position, x: pos.x, y: pos.y },
          };
        }
        return node;
      });

      textApi.setGraph({ ...currentGraph, nodes: updatedNodes });
    } catch (e) {
      result.warnings.push(
        `Auto-layout failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return result;
}

/**
 * Recursively create a node and its children.
 */
function createNodeRecursive(
  inferredNode: InferredNode,
  parentId: string | undefined,
  textApi: TextApi,
  registry: RegistryManagerCore,
  result: BuildResult,
  noteOptions: { noteAuthor: string; addDescriptionNotes: boolean },
): void {
  // Resolve the node type
  const { resolvedType, warning } = resolveNodeType(inferredNode.type, registry);
  if (warning) {
    result.warnings.push(warning);
  }

  // Create the node via TextApi
  const createdNode: ArchNode = textApi.addNode({
    type: resolvedType,
    displayName: inferredNode.displayName,
    parentId,
  });

  // Track the mapping from inference ID to actual ID
  result.nodeIdMap.set(inferredNode.id, createdNode.id);
  result.nodesCreated++;

  // Attach code references
  for (const codeRef of inferredNode.codeRefs) {
    attachCodeRef(codeRef, createdNode.id, textApi, result);
  }

  // Add description as a note
  if (noteOptions.addDescriptionNotes && inferredNode.description) {
    try {
      textApi.addNote({
        nodeId: createdNode.id,
        author: noteOptions.noteAuthor,
        content: inferredNode.description,
        tags: ['ai-inferred'],
      });
    } catch (e) {
      result.warnings.push(
        `Failed to add note to node '${inferredNode.displayName}': ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // Recursively create child nodes
  for (const child of inferredNode.children) {
    createNodeRecursive(child, createdNode.id, textApi, registry, result, noteOptions);
  }
}

/**
 * Create an edge between two nodes, mapping inference IDs to actual IDs.
 */
function createEdge(
  inferredEdge: InferredEdge,
  textApi: TextApi,
  result: BuildResult,
): void {
  const fromId = result.nodeIdMap.get(inferredEdge.from);
  const toId = result.nodeIdMap.get(inferredEdge.to);

  if (!fromId) {
    result.warnings.push(
      `Edge skipped: source node '${inferredEdge.from}' not found in created nodes`,
    );
    return;
  }

  if (!toId) {
    result.warnings.push(
      `Edge skipped: target node '${inferredEdge.to}' not found in created nodes`,
    );
    return;
  }

  try {
    textApi.addEdge({
      fromNode: fromId,
      toNode: toId,
      type: mapEdgeType(inferredEdge.type),
      label: inferredEdge.label || undefined,
    });
    result.edgesCreated++;
  } catch (e) {
    result.warnings.push(
      `Failed to create edge ${inferredEdge.from} -> ${inferredEdge.to}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Attach a code reference to a node.
 */
function attachCodeRef(
  codeRef: InferredCodeRef,
  nodeId: string,
  textApi: TextApi,
  result: BuildResult,
): void {
  try {
    textApi.addCodeRef({
      nodeId,
      path: codeRef.path,
      role: mapCodeRefRole(codeRef.role),
    });
    result.codeRefsAttached++;
  } catch (e) {
    result.warnings.push(
      `Failed to attach code ref '${codeRef.path}' to node: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
