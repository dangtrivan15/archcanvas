import type { Node, Edge, Canvas } from '@/types';
import type { NodeDefRegistry } from '@/core/registry/core';
import type { EngineWarning } from './types';

function warningKey(w: EngineWarning): string {
  switch (w.code) {
    case 'UNKNOWN_NODE_TYPE': return `${w.code}|${w.type}`;
    case 'INVALID_ARG': return `${w.code}|${w.nodeId}|${w.arg}`;
    case 'UNKNOWN_PORT': return `${w.code}|${w.nodeId}|${w.port}`;
    case 'INVALID_PORT_DIRECTION': return `${w.code}|${w.nodeId}|${w.port}`;
    case 'ENTITY_UNREFERENCED': return `${w.code}|${w.name}`;
  }
}

/**
 * Validate a node against the NodeDef registry.
 * Returns warnings (never throws). Returns [] for ref nodes.
 */
export function validateNode(
  node: Node,
  registry: NodeDefRegistry,
): EngineWarning[] {
  // Ref nodes have no type or args to validate
  if ('ref' in node) return [];

  const warnings: EngineWarning[] = [];
  const nodeDef = registry.resolve(node.type);

  if (!nodeDef) {
    warnings.push({ code: 'UNKNOWN_NODE_TYPE', type: node.type });
    return warnings;
  }

  // Args conformance (only if type resolves)
  const specArgs = nodeDef.spec.args ?? [];
  const nodeArgs = node.args ?? {};

  // Check each provided arg exists in the NodeDef
  const specArgNames = new Set(specArgs.map((a) => a.name));
  for (const argKey of Object.keys(nodeArgs)) {
    if (!specArgNames.has(argKey)) {
      warnings.push({
        code: 'INVALID_ARG',
        nodeId: node.id,
        arg: argKey,
        reason: 'unknown argument',
      });
    }
  }

  // Check required args are present and enum values are valid
  for (const argDef of specArgs) {
    const value = nodeArgs[argDef.name];

    if (argDef.required && value === undefined) {
      warnings.push({
        code: 'INVALID_ARG',
        nodeId: node.id,
        arg: argDef.name,
        reason: 'required argument missing',
      });
      continue;
    }

    if (
      value !== undefined &&
      argDef.type === 'enum' &&
      argDef.options &&
      !argDef.options.includes(String(value))
    ) {
      warnings.push({
        code: 'INVALID_ARG',
        nodeId: node.id,
        arg: argDef.name,
        reason: `invalid enum value, expected one of [${argDef.options.join(', ')}]`,
      });
    }
  }

  return warnings;
}

/**
 * Validate an edge's ports against the NodeDef registry.
 * Checks port existence and direction. Skips if node type is unknown.
 */
export function validateEdge(
  edge: Edge,
  canvas: Canvas,
  registry: NodeDefRegistry,
): EngineWarning[] {
  const warnings: EngineWarning[] = [];
  const nodes = canvas.nodes ?? [];

  const endpoints: Array<{
    endpoint: typeof edge.from;
    side: 'from' | 'to';
    expectedDirection: 'outbound' | 'inbound';
  }> = [
    { endpoint: edge.from, side: 'from', expectedDirection: 'outbound' },
    { endpoint: edge.to, side: 'to', expectedDirection: 'inbound' },
  ];

  for (const { endpoint, side: _, expectedDirection } of endpoints) {
    if (!endpoint.port) continue;

    // Skip @root/ references — cross-scope validation is not our concern
    if (endpoint.node.startsWith('@root/')) continue;

    // Find the node in canvas
    const node = nodes.find((n) => n.id === endpoint.node);
    if (!node || 'ref' in node) continue;

    // Resolve node type
    const nodeDef = registry.resolve(node.type);
    if (!nodeDef) continue; // Unknown type — already flagged by validateNode

    const ports = nodeDef.spec.ports ?? [];
    const portDef = ports.find((p) => p.name === endpoint.port);

    if (!portDef) {
      warnings.push({
        code: 'UNKNOWN_PORT',
        nodeId: endpoint.node,
        port: endpoint.port,
      });
      continue;
    }

    if (portDef.direction !== expectedDirection) {
      warnings.push({
        code: 'INVALID_PORT_DIRECTION',
        nodeId: endpoint.node,
        port: endpoint.port,
        expected: expectedDirection,
      });
    }
  }

  return warnings;
}

/**
 * Bulk-validate an entire canvas: all nodes, all edges, plus unreferenced entities.
 * Returns deduplicated warnings.
 */
export function validateCanvas(
  canvas: Canvas,
  registry: NodeDefRegistry,
): EngineWarning[] {
  const warnings: EngineWarning[] = [];

  // Validate all inline nodes
  for (const node of canvas.nodes ?? []) {
    warnings.push(...validateNode(node, registry));
  }

  // Validate all edges
  for (const edge of canvas.edges ?? []) {
    warnings.push(...validateEdge(edge, canvas, registry));
  }

  // Check for unreferenced entities
  const referencedEntities = new Set<string>();
  for (const edge of canvas.edges ?? []) {
    for (const entityName of edge.entities ?? []) {
      referencedEntities.add(entityName);
    }
  }

  for (const entity of canvas.entities ?? []) {
    if (!referencedEntities.has(entity.name)) {
      warnings.push({ code: 'ENTITY_UNREFERENCED', name: entity.name });
    }
  }

  // Deduplicate by canonical key (exhaustive switch ensures new codes are handled)
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = warningKey(w);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
