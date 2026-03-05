/**
 * Template Registry
 *
 * Loads built-in templates at app startup and provides a unified interface
 * to access both built-in and user-imported templates.
 * Built-in templates are bundled as static assets via Vite's ?raw imports.
 */

import { parse as parseYaml } from 'yaml';
import type { TemplateMetadata, TemplateRecord } from './types';
import type { StackTemplate } from '@/stacks/stackLoader';
import { getImportedTemplates, type ImportedTemplateRecord } from './storage';

// Import stack YAML files as raw strings via Vite's ?raw suffix
import saasStarterYaml from '@/stacks/saas-starter.yaml?raw';
import aiChatAppYaml from '@/stacks/ai-chat-app.yaml?raw';
import serverlessEventDrivenYaml from '@/stacks/serverless-event-driven.yaml?raw';
import microservicesPlatformYaml from '@/stacks/microservices-platform.yaml?raw';
import mobileBackendYaml from '@/stacks/mobile-backend.yaml?raw';
import mlPlatformYaml from '@/stacks/ml-platform.yaml?raw';
import dataPlatformYaml from '@/stacks/data-platform.yaml?raw';
import socialNetworkYaml from '@/stacks/social-network.yaml?raw';
import eCommercePlatformYaml from '@/stacks/e-commerce-platform.yaml?raw';
import fintechPaymentsYaml from '@/stacks/fintech-payments.yaml?raw';
import healthcareSystemYaml from '@/stacks/healthcare-system.yaml?raw';
import enterpriseCrmYaml from '@/stacks/enterprise-crm.yaml?raw';
import internalDevPlatformYaml from '@/stacks/internal-developer-platform.yaml?raw';
import iotPlatformYaml from '@/stacks/iot-platform.yaml?raw';

/** Raw YAML sources for all 14 built-in templates */
const BUILTIN_YAML_SOURCES: Array<{ name: string; rawYaml: string }> = [
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
  { name: 'healthcare-system', rawYaml: healthcareSystemYaml },
  { name: 'enterprise-crm', rawYaml: enterpriseCrmYaml },
  { name: 'internal-developer-platform', rawYaml: internalDevPlatformYaml },
  { name: 'iot-platform', rawYaml: iotPlatformYaml },
];

/** Cached built-in template records (parsed once) */
let builtinTemplatesCache: TemplateRecord[] | null = null;

/**
 * Parse a YAML source into a StackTemplate (same as stackLoader).
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
 * Convert a YAML source into a TemplateRecord with full metadata.
 */
function yamlSourceToTemplateRecord(rawYaml: string): TemplateRecord {
  const stack = parseStackYaml(rawYaml);

  const metadata: TemplateMetadata = {
    id: stack.metadata.name,
    name: stack.metadata.displayName,
    description: stack.metadata.description,
    icon: stack.metadata.icon,
    category: stack.metadata.tags?.[0] ?? 'general',
    nodeCount: stack.nodes.length,
    edgeCount: stack.edges.length,
    createdAt: 0, // Built-in templates have no meaningful creation time
    source: 'builtin',
    tags: stack.metadata.tags,
  };

  return { metadata, data: rawYaml };
}

/**
 * Convert an imported template record from IndexedDB to a TemplateRecord.
 */
function importedToTemplateRecord(imported: ImportedTemplateRecord): TemplateRecord {
  return {
    metadata: imported.metadata,
    data: imported.data,
  };
}

/**
 * Load all 14 built-in templates. Results are cached after first call.
 */
export function getBuiltinTemplates(): TemplateRecord[] {
  if (builtinTemplatesCache) return builtinTemplatesCache;

  builtinTemplatesCache = BUILTIN_YAML_SOURCES.map((source) =>
    yamlSourceToTemplateRecord(source.rawYaml),
  );

  return builtinTemplatesCache;
}

/**
 * Get all templates (built-in + user-imported).
 * Built-in templates are loaded synchronously from bundled assets.
 * Imported templates are loaded from IndexedDB (async).
 */
export async function getAllTemplates(): Promise<TemplateRecord[]> {
  const builtins = getBuiltinTemplates();

  try {
    const imported = await getImportedTemplates();
    const importedRecords = imported.map(importedToTemplateRecord);
    return [...builtins, ...importedRecords];
  } catch {
    // IndexedDB may not be available (e.g., in tests or SSR)
    return builtins;
  }
}

/**
 * Get a single template by ID. Checks built-in first, then imported.
 */
export async function getTemplateById(id: string): Promise<TemplateRecord | null> {
  // Check built-in first (synchronous)
  const builtin = getBuiltinTemplates().find((t) => t.metadata.id === id);
  if (builtin) return builtin;

  // Check imported (async)
  try {
    const imported = await getImportedTemplates();
    const found = imported.find((t) => t.metadata.id === id);
    return found ? importedToTemplateRecord(found) : null;
  } catch {
    return null;
  }
}

/**
 * Get only template metadata (without data payload) for lightweight listing.
 */
export async function getAllTemplateMetadata(): Promise<TemplateMetadata[]> {
  const all = await getAllTemplates();
  return all.map((t) => t.metadata);
}

/**
 * Clear the built-in templates cache (useful for testing).
 */
export function clearBuiltinCache(): void {
  builtinTemplatesCache = null;
}
