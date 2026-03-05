/**
 * Prompt Template Registry
 *
 * Central registry for all prompt templates. Provides template selection
 * (auto-select based on ProjectProfile or manual override), template listing,
 * and support for user-provided custom templates.
 */

import type { ProjectProfile } from '../detector';
import type { PromptTemplate, TemplateRegistryEntry, TemplateMatcher } from './types';
import { generalTemplate } from './general';
import { webAppTemplate } from './webApp';
import { microservicesTemplate } from './microservices';
import { dataPipelineTemplate } from './dataPipeline';
import { NODE_TYPE_REGISTRY_TEXT, STANDARD_RESPONSE_SCHEMA } from './shared';

// Re-export types
export type { PromptTemplate, AnalysisStep, ResponseSchema, PostProcessor, FewShotExample, TemplateRegistryEntry, TemplateMatcher } from './types';
export { NODE_TYPE_REGISTRY_TEXT, STANDARD_RESPONSE_SCHEMA };

// ── Matchers ─────────────────────────────────────────────────────────────────

/**
 * Match score for web application projects.
 * High score for projects with frontend frameworks and web-related entry points.
 */
const webAppMatcher: TemplateMatcher = (profile: ProjectProfile): number => {
  let score = 0;

  // Frontend framework detection
  const webFrameworks = ['React', 'Vue', 'Angular', 'Svelte', 'SvelteKit', 'Next.js', 'Nuxt', 'Remix', 'Astro', 'Gatsby'];
  for (const fw of profile.frameworks) {
    if (webFrameworks.includes(fw.name)) {
      score += fw.confidence === 'high' ? 30 : fw.confidence === 'medium' ? 20 : 10;
    }
  }

  // Backend framework detection
  const backendFrameworks = ['Express', 'Express.js', 'Koa', 'Fastify', 'Hapi', 'Django', 'Flask', 'FastAPI', 'Rails', 'Spring Boot', 'Gin', 'Actix Web'];
  for (const fw of profile.frameworks) {
    if (backendFrameworks.includes(fw.name)) {
      score += fw.confidence === 'high' ? 15 : 10;
    }
  }

  // Single-app project type boost
  if (profile.projectType === 'single-app') {
    score += 10;
  }

  // Web-related entry points
  const webEntryPoints = ['index.html', 'src/App.tsx', 'src/App.jsx', 'src/main.tsx', 'pages/', 'app/'];
  for (const ep of profile.entryPoints) {
    if (webEntryPoints.some(pattern => ep.includes(pattern))) {
      score += 5;
    }
  }

  // Tailwind/CSS frameworks boost
  if (profile.frameworks.some(f => f.name === 'Tailwind CSS')) {
    score += 5;
  }

  return Math.min(score, 100);
};

/**
 * Match score for microservices projects.
 * High score for multi-service projects with Docker/K8s infrastructure.
 */
const microservicesMatcher: TemplateMatcher = (profile: ProjectProfile): number => {
  let score = 0;

  // Project type is the strongest signal
  if (profile.projectType === 'microservices') {
    score += 50;
  } else if (profile.projectType === 'monorepo') {
    score += 20; // Monorepos often contain microservices
  }

  // Infrastructure signals
  for (const signal of profile.infraSignals) {
    if (signal.type === 'kubernetes') score += 25;
    if (signal.type === 'docker-compose') score += 15;
    if (signal.type === 'docker') score += 10;
    if (signal.type === 'terraform') score += 10;
  }

  // Message broker / event bus data stores
  for (const ds of profile.dataStores) {
    const dsType = ds.type.toLowerCase();
    if (['kafka', 'rabbitmq', 'nats', 'redis'].includes(dsType)) {
      score += 10;
    }
  }

  // gRPC / proto signals
  if (profile.dataStores.some(ds => ds.type === 'protobuf')) {
    score += 10;
  }

  // Multiple languages suggest separate services
  if (profile.languages.length >= 3) {
    score += 10;
  }

  return Math.min(score, 100);
};

/**
 * Match score for data pipeline projects.
 * High score for projects with ETL/analytics frameworks and data-heavy infrastructure.
 */
const dataPipelineMatcher: TemplateMatcher = (profile: ProjectProfile): number => {
  let score = 0;

  // Data pipeline frameworks
  const pipelineFrameworks = ['Airflow', 'Dagster', 'Prefect', 'dbt', 'Spark', 'Luigi'];
  for (const fw of profile.frameworks) {
    if (pipelineFrameworks.includes(fw.name)) {
      score += fw.confidence === 'high' ? 40 : 25;
    }
  }

  // Python is the dominant data pipeline language
  const pythonLang = profile.languages.find(l => l.name === 'Python');
  if (pythonLang && pythonLang.percentage > 50) {
    score += 10;
  }

  // Data-related infrastructure
  for (const signal of profile.infraSignals) {
    if (signal.type === 'aws') score += 5;
  }

  // Data stores that suggest pipeline workloads
  for (const ds of profile.dataStores) {
    const dsType = ds.type.toLowerCase();
    if (['snowflake', 'bigquery', 'redshift', 'clickhouse', 'druid'].includes(dsType)) {
      score += 20;
    }
    if (['alembic', 'knex', 'prisma', 'drizzle'].includes(dsType)) {
      score += 5;
    }
  }

  // Presence of DAG-like directory structures (checked via entry points)
  for (const ep of profile.entryPoints) {
    if (ep.includes('dag') || ep.includes('pipeline') || ep.includes('etl')) {
      score += 15;
    }
  }

  return Math.min(score, 100);
};

/**
 * General template always returns a base score as fallback.
 */
const generalMatcher: TemplateMatcher = (): number => 10;

// ── Built-in Registry ────────────────────────────────────────────────────────

/** Built-in template registry entries */
const BUILTIN_TEMPLATES: TemplateRegistryEntry[] = [
  { template: generalTemplate, matcher: generalMatcher },
  { template: webAppTemplate, matcher: webAppMatcher },
  { template: microservicesTemplate, matcher: microservicesMatcher },
  { template: dataPipelineTemplate, matcher: dataPipelineMatcher },
];

/** Custom templates added at runtime (e.g., from config file) */
let customTemplates: TemplateRegistryEntry[] = [];

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all available templates (built-in + custom).
 */
export function listTemplates(): PromptTemplate[] {
  return [...BUILTIN_TEMPLATES, ...customTemplates].map(e => e.template);
}

/**
 * Get a template by its ID.
 */
export function getTemplateById(id: string): PromptTemplate | undefined {
  const all = [...BUILTIN_TEMPLATES, ...customTemplates];
  return all.find(e => e.template.id === id)?.template;
}

/**
 * Auto-select the best prompt template for a given project profile.
 *
 * Evaluates all registered templates against the profile using their
 * matcher functions and returns the one with the highest score.
 * Falls back to the general template if no domain-specific template scores above threshold.
 *
 * @param profile - The detected project profile
 * @param minScore - Minimum score to beat general template (default: 20)
 * @returns The best-matching prompt template
 */
export function selectTemplate(
  profile: ProjectProfile,
  minScore: number = 20,
): PromptTemplate {
  const all = [...BUILTIN_TEMPLATES, ...customTemplates];

  let bestEntry = all[0]; // general is first
  let bestScore = all[0].matcher(profile);

  for (let i = 1; i < all.length; i++) {
    const score = all[i].matcher(profile);
    if (score > bestScore && score >= minScore) {
      bestScore = score;
      bestEntry = all[i];
    }
  }

  return bestEntry.template;
}

/**
 * Select a template: by explicit ID (manual override), or auto-select based on profile.
 *
 * @param profile - The detected project profile
 * @param templateId - Optional template ID for manual override
 * @returns The selected prompt template
 */
export function resolveTemplate(
  profile: ProjectProfile,
  templateId?: string,
): PromptTemplate {
  if (templateId) {
    const template = getTemplateById(templateId);
    if (template) return template;
    // Fall through to auto-select if ID not found
  }
  return selectTemplate(profile);
}

/**
 * Register a custom prompt template.
 *
 * @param template - The custom template to register
 * @param matcher - Optional matcher function (defaults to score 0 = manual-only)
 */
export function registerCustomTemplate(
  template: PromptTemplate,
  matcher: TemplateMatcher = () => 0,
): void {
  // Remove existing template with same ID if present
  customTemplates = customTemplates.filter(e => e.template.id !== template.id);
  customTemplates.push({ template, matcher });
}

/**
 * Remove a custom template by ID.
 * Returns true if the template was found and removed.
 */
export function unregisterCustomTemplate(id: string): boolean {
  const before = customTemplates.length;
  customTemplates = customTemplates.filter(e => e.template.id !== id);
  return customTemplates.length < before;
}

/**
 * Clear all custom templates. (Useful for testing.)
 */
export function clearCustomTemplates(): void {
  customTemplates = [];
}

/**
 * Load custom prompt templates from a user config object.
 *
 * This supports the .archcanvas.yml config file format where users can define
 * custom prompt templates with their own system prompts, analysis steps, and
 * few-shot examples.
 *
 * @param configs - Array of template config objects from the user's config file
 */
export function loadCustomTemplatesFromConfig(
  configs: CustomTemplateConfig[],
): void {
  for (const config of configs) {
    const template = configToTemplate(config);
    registerCustomTemplate(template, () => config.autoSelectScore ?? 0);
  }
}

/**
 * Configuration format for user-provided custom templates (from .archcanvas.yml).
 */
export interface CustomTemplateConfig {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Tags for matching */
  tags?: string[];
  /** System prompt override */
  systemPrompt?: string;
  /** Custom user prompt template */
  userPrompt: string;
  /** Auto-select score (0 = manual only, higher = more likely to be auto-selected) */
  autoSelectScore?: number;
}

/**
 * Convert a CustomTemplateConfig into a full PromptTemplate.
 */
function configToTemplate(config: CustomTemplateConfig): PromptTemplate {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    tags: config.tags ?? [],

    systemPrompt:
      config.systemPrompt ??
      `You are an expert software architect analyzing a codebase to infer its system architecture.
Respond ONLY with valid JSON matching the specified schema. No markdown, no explanations.`,

    analysisSteps: [
      {
        name: config.name,
        systemPrompt: '',
        userPrompt: config.userPrompt.includes('{{nodeTypes}}')
          ? config.userPrompt.replace('{{nodeTypes}}', NODE_TYPE_REGISTRY_TEXT)
          : `${config.userPrompt}\n\n${NODE_TYPE_REGISTRY_TEXT}`,
      },
    ],

    responseSchema: STANDARD_RESPONSE_SCHEMA,
  };
}
