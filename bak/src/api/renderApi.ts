/**
 * Render API - transforms internal ArchGraph to React Flow nodes and edges.
 * Handles navigation-level-aware rendering for fractal zoom.
 */

import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import type { CanvasNode, CanvasNodeData, CanvasEdge, CanvasEdgeData } from '@/types/canvas';
import type { RegistryManager } from '@/core/registry/registryManager';
import { getNodesAtLevel, getEdgesAtLevel } from '@/core/graph/graphQuery';

/**
 * RenderApi transforms the internal ArchGraph into React Flow nodes and edges
 * for canvas rendering. It handles fractal zoom navigation, node shape resolution
 * via NodeDef metadata, and port mapping.
 *
 * @example
 * ```ts
 * const renderApi = new RenderApi(registry);
 * const { nodes, edges } = renderApi.render(graph, navigationPath);
 * // nodes/edges are ready for <ReactFlow nodes={nodes} edges={edges} />
 * ```
 */
export class RenderApi {
  private readonly registry: RegistryManager;

  /** @param registry - Node type registry for resolving shapes, icons, and ports */
  constructor(registry: RegistryManager) {
    this.registry = registry;
  }

  /**
   * Transform the architecture graph into React Flow nodes and edges
   * for the given navigation path (fractal zoom level).
   *
   * @param graph - The architecture graph to render
   * @param navigationPath - Fractal zoom path (empty = root level, ['nodeId'] = children of nodeId)
   * @returns React Flow-compatible nodes and edges for the current navigation level
   */
  render(graph: ArchGraph, navigationPath: string[]): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
    const archNodes = getNodesAtLevel(graph, navigationPath);
    const archEdges = getEdgesAtLevel(graph, navigationPath);

    const canvasNodes = archNodes.map((node) => this.toCanvasNode(node));
    const canvasEdges = archEdges.map((edge) => this.toCanvasEdge(edge));

    return { nodes: canvasNodes, edges: canvasEdges };
  }

  /**
   * Transform an ArchNode into a React Flow CanvasNode.
   */
  private toCanvasNode(node: ArchNode): CanvasNode {
    const nodeDef = this.registry.resolve(node.type);

    // Build port info from nodedef
    const inboundPorts = (nodeDef?.spec.ports ?? [])
      .filter((p) => p.direction === 'inbound')
      .map((p) => ({ name: p.name, protocol: p.protocol }));

    const outboundPorts = (nodeDef?.spec.ports ?? [])
      .filter((p) => p.direction === 'outbound')
      .map((p) => ({ name: p.name, protocol: p.protocol }));

    const noteCount = node.notes.length;

    // Determine component type:
    // - .archc refSource nodes get 'container' type (nested canvas)
    // - Other refSource nodes get 'ref' type
    // - Others based on shape metadata or namespace
    const isArchcRef = node.refSource?.endsWith('.archc') ?? false;
    const nodeType = isArchcRef
      ? 'container'
      : node.refSource
        ? 'ref'
        : this.getNodeComponentType(node.type, nodeDef?.metadata.shape);

    const data: CanvasNodeData = {
      archNodeId: node.id,
      displayName: node.displayName,
      nodedefType: node.type,
      args: { ...node.args },
      ports: {
        inbound: inboundPorts,
        outbound: outboundPorts,
      },
      hasChildren: node.children.length > 0,
      noteCount,
      codeRefCount: node.codeRefs.length,
      properties: { ...node.properties },
      icon: nodeDef?.metadata.icon ?? 'Box',
      color: node.position.color,
      refSource: node.refSource,
    };

    return {
      id: node.id,
      type: nodeType,
      position: { x: node.position.x, y: node.position.y },
      data,
    };
  }

  /**
   * Transform an ArchEdge into a React Flow CanvasEdge.
   */
  private toCanvasEdge(edge: ArchEdge): CanvasEdge {
    const edgeType = this.getEdgeComponentType(edge.type);

    const data: CanvasEdgeData = {
      archEdgeId: edge.id,
      edgeType: edge.type,
      label: edge.label,
      noteCount: edge.notes.length,
    };

    return {
      id: edge.id,
      source: edge.fromNode,
      target: edge.toNode,
      sourceHandle: edge.fromPort,
      targetHandle: edge.toPort,
      type: edgeType,
      label: edge.label,
      data,
    };
  }

  /**
   * Map shape name from NodeDef metadata to React Flow node component type.
   * This is a static mapping from shape → component type string.
   */
  private static readonly SHAPE_TO_COMPONENT: Record<string, string> = {
    rectangle: 'generic',
    cylinder: 'database',
    hexagon: 'gateway',
    parallelogram: 'queue',
    cloud: 'cloud',
    stadium: 'stadium',
    document: 'document',
    badge: 'generic',
    container: 'container',
  };

  /**
   * Map nodedef type to React Flow node component type.
   * Checks nodedef.metadata.shape first, then falls back to namespace-based switch.
   */
  private getNodeComponentType(type: string, shape?: string): string {
    // If nodedef specifies a shape, use it to select the component
    if (shape && shape in RenderApi.SHAPE_TO_COMPONENT) {
      return RenderApi.SHAPE_TO_COMPONENT[shape] ?? 'generic';
    }

    // Fallback: namespace-based mapping for nodedefs without shape metadata
    const namespace = type.split('/')[0];

    switch (namespace) {
      case 'compute': {
        const name = type.split('/')[1];
        if (name === 'api-gateway') return 'gateway';
        return name === 'service' ? 'service' : 'generic';
      }
      case 'data': {
        const name = type.split('/')[1];
        if (name === 'database') return 'database';
        if (name === 'cache') return 'cache';
        if (name === 'object-storage') return 'object-storage';
        if (name === 'repository') return 'repository';
        return 'generic';
      }
      case 'messaging': {
        const name = type.split('/')[1];
        if (name === 'message-queue') return 'queue';
        if (name === 'stream-processor') return 'stream-processor';
        if (name === 'event-bus') return 'event-bus';
        return 'generic';
      }
      case 'network': {
        const name = type.split('/')[1];
        if (name === 'load-balancer') return 'gateway';
        if (name === 'cdn') return 'cdn';
        return 'generic';
      }
      case 'observability': {
        const name = type.split('/')[1];
        if (name === 'logging') return 'logging';
        return 'generic';
      }
      case 'meta': {
        const name = type.split('/')[1];
        if (name === 'canvas-ref') return 'container';
        return 'generic';
      }
      default:
        return 'generic';
    }
  }

  /**
   * Map edge type to React Flow edge component type.
   */
  private getEdgeComponentType(type: ArchEdge['type']): string {
    switch (type) {
      case 'sync':
        return 'sync';
      case 'async':
        return 'async';
      case 'data-flow':
        return 'dataFlow';
      default:
        return 'sync';
    }
  }
}
