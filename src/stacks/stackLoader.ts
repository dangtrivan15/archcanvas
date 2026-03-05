/**
 * Stack Template Loader.
 * Loads predefined stack templates (YAML) and instantiates them as ArchGraph.
 * Each stack defines a set of nodes with pre-filled args, positions, and edges.
 */

import { parse as parseYaml } from 'yaml';
import type { ArchGraph, ArchNode, ArchEdge, EdgeType } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

// Import stack YAML files as raw strings via Vite's ?raw suffix
import saasStarterYaml from './saas-starter.yaml?raw';
import aiChatAppYaml from './ai-chat-app.yaml?raw';
import serverlessEventDrivenYaml from './serverless-event-driven.yaml?raw';
import microservicesPlatformYaml from './microservices-platform.yaml?raw';
import mobileBackendYaml from './mobile-backend.yaml?raw';
import mlPlatformYaml from './ml-platform.yaml?raw';
import dataPlatformYaml from './data-platform.yaml?raw';
import socialNetworkYaml from './social-network.yaml?raw';
import eCommercePlatformYaml from './e-commerce-platform.yaml?raw';
import fintechPaymentsYaml from './fintech-payments.yaml?raw';

/**
 * A parsed stack template definition.
 */
export interface StackTemplate {
  metadata: {
    name: string;
    displayName: string;
    description: string;
    icon: string;
    tags: string[];
  };
  nodes: Array<{
    id: string; // local ID within the template
    type: string;
    displayName: string;
    args?: Record<string, string | number | boolean>;
    position: { x: number; y: number; width?: number; height?: number };
  }>;
  edges: Array<{
    fromNode: string; // refers to template-local node id
    toNode: string;
    type: EdgeType;
    label?: string;
  }>;
}

/**
 * Registry of all available stack templates.
 */
const STACK_SOURCES: Array<{ name: string; rawYaml: string }> = [
  { name: 'saas-starter', rawYaml: saasStarterYaml },
  { name: 'ai-chat-app', rawYaml: aiChatAppYaml },
  { name: 'serverless-event-driven', rawYaml: serverlessEventDrivenYaml },
  { name: 'microservices-platform', rawYaml: microservicesPlatformYaml },
  { name: 'mobile-backend', rawYaml: mobileBackendYaml },
  { name: 'ml-platform', rawYaml: mlPlatformYaml },
  { name: 'data-platform', rawYaml: dataPlatformYaml },
  { name: 'social-network', rawYaml: socialNetworkYaml },
  { name: 'e-commerce-platform', rawYaml: eCommercePlatformYaml },
  { name: 'fintech-payments', rawYaml: fintechPaymentsYaml },
];

/**
 * Parse a YAML string into a StackTemplate.
 */
function parseStackYaml(yamlContent: string): StackTemplate {
  const parsed = parseYaml(yamlContent) as {
    metadata: StackTemplate['metadata'];
    nodes: StackTemplate['nodes'];
    edges: StackTemplate['edges'];
  };
  return {
    metadata: parsed.metadata,
    nodes: parsed.nodes || [],
    edges: parsed.edges || [],
  };
}

/**
 * Get all available stack templates (parsed and ready).
 */
export function getAvailableStacks(): StackTemplate[] {
  return STACK_SOURCES.map((source) => parseStackYaml(source.rawYaml));
}

/**
 * Instantiate a stack template into an ArchGraph.
 * Generates fresh ULIDs for all nodes and edges, and rewires edge references.
 */
export function instantiateStack(template: StackTemplate): ArchGraph {
  // Map template-local IDs to generated ULIDs
  const idMap = new Map<string, string>();
  for (const nodeDef of template.nodes) {
    idMap.set(nodeDef.id, generateId());
  }

  // Create nodes
  const nodes: ArchNode[] = template.nodes.map((nodeDef) => ({
    id: idMap.get(nodeDef.id)!,
    type: nodeDef.type,
    displayName: nodeDef.displayName,
    args: nodeDef.args ?? {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: {
      x: nodeDef.position.x,
      y: nodeDef.position.y,
      width: nodeDef.position.width ?? 200,
      height: nodeDef.position.height ?? 100,
    },
    children: [],
  }));

  // Create edges
  const edges: ArchEdge[] = template.edges.map((edgeDef) => ({
    id: generateId(),
    fromNode: idMap.get(edgeDef.fromNode) ?? edgeDef.fromNode,
    toNode: idMap.get(edgeDef.toNode) ?? edgeDef.toNode,
    type: edgeDef.type,
    label: edgeDef.label,
    properties: {},
    notes: [],
  }));

  return {
    name: template.metadata.displayName,
    description: template.metadata.description,
    owners: [],
    nodes,
    edges,
  };
}
