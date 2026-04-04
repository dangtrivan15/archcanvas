import { ArchTemplateSchema, type ArchTemplate, type TemplateCategory } from './schema';

// ---------------------------------------------------------------------------
// Registry — all templates are imported statically and cached once.
// ---------------------------------------------------------------------------

import { microservicesTemplate } from './data/microservices';
import { serverlessTemplate } from './data/serverless';
import { monolithTemplate } from './data/monolith';
import { eventDrivenTemplate } from './data/eventDriven';
import { frontendSpaTemplate } from './data/frontendSpa';
import { dataPipelineTemplate } from './data/dataPipeline';
import { cicdPipelineTemplate } from './data/cicdPipeline';
import { mobileBackendTemplate } from './data/mobileBackend';

const rawTemplates: ArchTemplate[] = [
  microservicesTemplate,
  serverlessTemplate,
  monolithTemplate,
  eventDrivenTemplate,
  frontendSpaTemplate,
  dataPipelineTemplate,
  cicdPipelineTemplate,
  mobileBackendTemplate,
];

// Validate all templates at load time and cache the results
let _cache: ArchTemplate[] | null = null;

function ensureCache(): ArchTemplate[] {
  if (_cache) return _cache;

  _cache = rawTemplates.map((t) => {
    const result = ArchTemplateSchema.safeParse(t);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      console.error(`[templates] Invalid template "${t.id}": ${issues}`);
      // Return as-is — schema is compile-time checked via TypeScript types
      return t;
    }
    return result.data;
  });

  return _cache;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getAllTemplates(): ArchTemplate[] {
  return ensureCache();
}

export function getTemplateById(id: string): ArchTemplate | undefined {
  return ensureCache().find((t) => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): ArchTemplate[] {
  return ensureCache().filter((t) => t.category === category);
}

export function searchTemplates(query: string): ArchTemplate[] {
  if (!query.trim()) return ensureCache();
  const q = query.toLowerCase();
  return ensureCache().filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q)),
  );
}

/** Reset cache — primarily for testing */
export function _resetCache(): void {
  _cache = null;
}
