import { describe, it, expect, beforeEach } from 'vitest';
import type { ProjectProfile } from '../../../../src/analyze/detector';
import type { PromptTemplate } from '../../../../src/analyze/prompts/types';
import {
  listTemplates,
  getTemplateById,
  selectTemplate,
  resolveTemplate,
  registerCustomTemplate,
  unregisterCustomTemplate,
  clearCustomTemplates,
  loadCustomTemplatesFromConfig,
} from '../../../../src/analyze/prompts';
import { generalTemplate } from '../../../../src/analyze/prompts/general';
import { webAppTemplate } from '../../../../src/analyze/prompts/webApp';
import { microservicesTemplate } from '../../../../src/analyze/prompts/microservices';
import { dataPipelineTemplate } from '../../../../src/analyze/prompts/dataPipeline';
import {
  NODE_TYPE_REGISTRY_TEXT,
  STANDARD_RESPONSE_SCHEMA,
} from '../../../../src/analyze/prompts/shared';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    languages: [{ name: 'TypeScript', extensions: ['.ts', '.tsx'], fileCount: 50, percentage: 80 }],
    frameworks: [],
    projectType: 'single-app',
    buildSystems: ['npm'],
    infraSignals: [],
    dataStores: [],
    entryPoints: ['src/index.ts'],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Prompt Template System', () => {
  beforeEach(() => {
    clearCustomTemplates();
  });

  describe('PromptTemplate interface', () => {
    it('general template has all required fields', () => {
      expectValidTemplate(generalTemplate);
    });

    it('webApp template has all required fields', () => {
      expectValidTemplate(webAppTemplate);
    });

    it('microservices template has all required fields', () => {
      expectValidTemplate(microservicesTemplate);
    });

    it('dataPipeline template has all required fields', () => {
      expectValidTemplate(dataPipelineTemplate);
    });

    function expectValidTemplate(t: PromptTemplate) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.tags).toBeInstanceOf(Array);
      expect(t.tags.length).toBeGreaterThan(0);
      expect(t.systemPrompt).toBeTruthy();
      expect(t.analysisSteps).toBeInstanceOf(Array);
      expect(t.analysisSteps.length).toBeGreaterThan(0);
      expect(t.responseSchema).toBeDefined();
      expect(t.responseSchema.schemaText).toContain('architectureName');
      expect(t.responseSchema.schemaText).toContain('nodes');
      expect(t.responseSchema.schemaText).toContain('edges');

      // Each step has required fields
      for (const step of t.analysisSteps) {
        expect(step.name).toBeTruthy();
        expect(step.userPrompt).toBeTruthy();
      }
    }
  });

  describe('Node type registry in templates', () => {
    it('NODE_TYPE_REGISTRY_TEXT contains all major namespaces', () => {
      expect(NODE_TYPE_REGISTRY_TEXT).toContain('compute/service');
      expect(NODE_TYPE_REGISTRY_TEXT).toContain('data/database');
      expect(NODE_TYPE_REGISTRY_TEXT).toContain('messaging/event-bus');
      expect(NODE_TYPE_REGISTRY_TEXT).toContain('network/load-balancer');
      expect(NODE_TYPE_REGISTRY_TEXT).toContain('observability/monitoring');
      expect(NODE_TYPE_REGISTRY_TEXT).toContain('security/auth-provider');
      expect(NODE_TYPE_REGISTRY_TEXT).toContain('integration/third-party-api');
      expect(NODE_TYPE_REGISTRY_TEXT).toContain('client/web-app');
    });

    it('all templates include node type registry in analysis prompts', () => {
      const templates = [
        generalTemplate,
        webAppTemplate,
        microservicesTemplate,
        dataPipelineTemplate,
      ];
      for (const t of templates) {
        const prompt = t.analysisSteps[0].userPrompt;
        expect(prompt).toContain('Available ArchCanvas Node Types');
        expect(prompt).toContain('compute/service');
      }
    });
  });

  describe('Few-shot examples', () => {
    it('general template has few-shot examples', () => {
      expect(generalTemplate.fewShotExamples).toBeDefined();
      expect(generalTemplate.fewShotExamples!.length).toBeGreaterThan(0);
    });

    it('few-shot examples contain valid JSON output', () => {
      const templates = [
        generalTemplate,
        webAppTemplate,
        microservicesTemplate,
        dataPipelineTemplate,
      ];
      for (const t of templates) {
        if (t.fewShotExamples) {
          for (const example of t.fewShotExamples) {
            expect(example.scenario).toBeTruthy();
            expect(example.input).toBeTruthy();
            // Output should be valid JSON
            const parsed = JSON.parse(example.output);
            expect(parsed.architectureName).toBeTruthy();
            expect(parsed.nodes).toBeInstanceOf(Array);
            expect(parsed.nodes.length).toBeGreaterThan(0);
            expect(parsed.edges).toBeInstanceOf(Array);
            // Nodes should have correct structure
            for (const node of parsed.nodes) {
              expect(node.id).toBeTruthy();
              expect(node.type).toBeTruthy();
              expect(node.displayName).toBeTruthy();
            }
          }
        }
      }
    });

    it('few-shot examples are included in prompt text', () => {
      const templates = [
        generalTemplate,
        webAppTemplate,
        microservicesTemplate,
        dataPipelineTemplate,
      ];
      for (const t of templates) {
        const prompt = t.analysisSteps[0].userPrompt;
        expect(prompt).toContain('Few-Shot Example');
        expect(prompt).toContain('Scenario');
      }
    });
  });

  describe('Response schema', () => {
    it('STANDARD_RESPONSE_SCHEMA includes all required fields', () => {
      const schema = STANDARD_RESPONSE_SCHEMA.schemaText;
      expect(schema).toContain('architectureName');
      expect(schema).toContain('architectureDescription');
      expect(schema).toContain('nodes');
      expect(schema).toContain('edges');
      expect(schema).toContain('type');
      expect(schema).toContain('displayName');
      expect(schema).toContain('codeRefs');
      expect(schema).toContain('children');
    });
  });

  describe('listTemplates', () => {
    it('returns all 4 built-in templates', () => {
      const templates = listTemplates();
      expect(templates.length).toBe(4);
      const ids = templates.map((t) => t.id);
      expect(ids).toContain('general');
      expect(ids).toContain('web-app');
      expect(ids).toContain('microservices');
      expect(ids).toContain('data-pipeline');
    });

    it('includes custom templates when registered', () => {
      const custom: PromptTemplate = {
        id: 'custom-test',
        name: 'Custom Test',
        description: 'A custom template',
        tags: ['custom'],
        systemPrompt: 'test',
        analysisSteps: [{ name: 'Step 1', systemPrompt: '', userPrompt: 'test' }],
        responseSchema: STANDARD_RESPONSE_SCHEMA,
      };
      registerCustomTemplate(custom);
      const templates = listTemplates();
      expect(templates.length).toBe(5);
      expect(templates.map((t) => t.id)).toContain('custom-test');
    });
  });

  describe('getTemplateById', () => {
    it('returns template by ID', () => {
      expect(getTemplateById('general')?.id).toBe('general');
      expect(getTemplateById('web-app')?.id).toBe('web-app');
      expect(getTemplateById('microservices')?.id).toBe('microservices');
      expect(getTemplateById('data-pipeline')?.id).toBe('data-pipeline');
    });

    it('returns undefined for unknown ID', () => {
      expect(getTemplateById('nonexistent')).toBeUndefined();
    });
  });

  describe('selectTemplate - auto-selection', () => {
    it('selects web-app template for React projects', () => {
      const profile = makeProfile({
        frameworks: [
          { name: 'React', confidence: 'high', evidence: 'package.json' },
          { name: 'Vite', confidence: 'medium', evidence: 'vite.config.ts' },
        ],
        entryPoints: ['src/App.tsx'],
      });
      const selected = selectTemplate(profile);
      expect(selected.id).toBe('web-app');
    });

    it('selects web-app template for Django projects', () => {
      const profile = makeProfile({
        languages: [{ name: 'Python', extensions: ['.py'], fileCount: 100, percentage: 90 }],
        frameworks: [{ name: 'Django', confidence: 'high', evidence: 'manage.py' }],
        entryPoints: ['manage.py'],
      });
      const selected = selectTemplate(profile);
      expect(selected.id).toBe('web-app');
    });

    it('selects microservices template for Docker/K8s projects', () => {
      const profile = makeProfile({
        projectType: 'microservices',
        infraSignals: [
          { type: 'docker', evidence: 'Dockerfile' },
          { type: 'kubernetes', evidence: 'k8s/ directory' },
        ],
        languages: [
          { name: 'Go', extensions: ['.go'], fileCount: 50, percentage: 40 },
          { name: 'TypeScript', extensions: ['.ts'], fileCount: 30, percentage: 30 },
          { name: 'Python', extensions: ['.py'], fileCount: 20, percentage: 20 },
        ],
      });
      const selected = selectTemplate(profile);
      expect(selected.id).toBe('microservices');
    });

    it('selects data-pipeline template for Airflow projects', () => {
      const profile = makeProfile({
        languages: [{ name: 'Python', extensions: ['.py'], fileCount: 100, percentage: 85 }],
        frameworks: [{ name: 'Airflow', confidence: 'high', evidence: 'airflow.cfg' }],
        entryPoints: ['dags/main_pipeline.py'],
      });
      const selected = selectTemplate(profile);
      expect(selected.id).toBe('data-pipeline');
    });

    it('falls back to general template for unknown projects', () => {
      const profile = makeProfile({
        languages: [{ name: 'Haskell', extensions: ['.hs'], fileCount: 20, percentage: 100 }],
        frameworks: [],
        projectType: 'library',
      });
      const selected = selectTemplate(profile);
      expect(selected.id).toBe('general');
    });
  });

  describe('resolveTemplate', () => {
    it('uses manual override when template ID is provided', () => {
      const profile = makeProfile(); // Would auto-select general
      const resolved = resolveTemplate(profile, 'microservices');
      expect(resolved.id).toBe('microservices');
    });

    it('falls back to auto-select when template ID is not found', () => {
      const profile = makeProfile({
        frameworks: [{ name: 'React', confidence: 'high', evidence: 'package.json' }],
      });
      const resolved = resolveTemplate(profile, 'nonexistent');
      // Should auto-select web-app since React is present
      expect(resolved.id).toBe('web-app');
    });

    it('auto-selects when no template ID provided', () => {
      const profile = makeProfile({
        projectType: 'microservices',
        infraSignals: [{ type: 'kubernetes', evidence: 'k8s/' }],
      });
      const resolved = resolveTemplate(profile);
      expect(resolved.id).toBe('microservices');
    });
  });

  describe('Custom templates', () => {
    it('registerCustomTemplate adds a template', () => {
      const custom: PromptTemplate = {
        id: 'my-custom',
        name: 'My Custom',
        description: 'Custom template',
        tags: ['custom'],
        systemPrompt: 'You are a custom analyzer.',
        analysisSteps: [
          { name: 'Analyze', systemPrompt: '', userPrompt: 'Analyze {{projectProfile}}' },
        ],
        responseSchema: STANDARD_RESPONSE_SCHEMA,
      };
      registerCustomTemplate(custom);
      expect(getTemplateById('my-custom')).toBeDefined();
      expect(getTemplateById('my-custom')!.name).toBe('My Custom');
    });

    it('registerCustomTemplate replaces existing template with same ID', () => {
      const v1: PromptTemplate = {
        id: 'replaceable',
        name: 'V1',
        description: 'Version 1',
        tags: [],
        systemPrompt: 'v1',
        analysisSteps: [{ name: 'S1', systemPrompt: '', userPrompt: 'v1' }],
        responseSchema: STANDARD_RESPONSE_SCHEMA,
      };
      const v2: PromptTemplate = { ...v1, name: 'V2', systemPrompt: 'v2' };

      registerCustomTemplate(v1);
      registerCustomTemplate(v2);

      const templates = listTemplates().filter((t) => t.id === 'replaceable');
      expect(templates.length).toBe(1);
      expect(templates[0].name).toBe('V2');
    });

    it('unregisterCustomTemplate removes a template', () => {
      const custom: PromptTemplate = {
        id: 'removable',
        name: 'Removable',
        description: 'Will be removed',
        tags: [],
        systemPrompt: 'test',
        analysisSteps: [{ name: 'S', systemPrompt: '', userPrompt: 'test' }],
        responseSchema: STANDARD_RESPONSE_SCHEMA,
      };
      registerCustomTemplate(custom);
      expect(getTemplateById('removable')).toBeDefined();

      const removed = unregisterCustomTemplate('removable');
      expect(removed).toBe(true);
      expect(getTemplateById('removable')).toBeUndefined();
    });

    it('unregisterCustomTemplate returns false for non-existent ID', () => {
      expect(unregisterCustomTemplate('nonexistent')).toBe(false);
    });

    it('clearCustomTemplates removes all custom templates', () => {
      registerCustomTemplate({
        id: 'c1',
        name: 'C1',
        description: '',
        tags: [],
        systemPrompt: '',
        analysisSteps: [{ name: 'S', systemPrompt: '', userPrompt: '' }],
        responseSchema: STANDARD_RESPONSE_SCHEMA,
      });
      registerCustomTemplate({
        id: 'c2',
        name: 'C2',
        description: '',
        tags: [],
        systemPrompt: '',
        analysisSteps: [{ name: 'S', systemPrompt: '', userPrompt: '' }],
        responseSchema: STANDARD_RESPONSE_SCHEMA,
      });

      expect(listTemplates().length).toBe(6); // 4 built-in + 2 custom
      clearCustomTemplates();
      expect(listTemplates().length).toBe(4);
    });

    it('custom templates participate in auto-selection when matcher has high score', () => {
      const custom: PromptTemplate = {
        id: 'rust-embedded',
        name: 'Rust Embedded Systems',
        description: 'For Rust embedded projects',
        tags: ['rust', 'embedded'],
        systemPrompt: 'You are an embedded systems architect.',
        analysisSteps: [
          { name: 'Analyze', systemPrompt: '', userPrompt: 'Analyze {{projectProfile}}' },
        ],
        responseSchema: STANDARD_RESPONSE_SCHEMA,
      };

      registerCustomTemplate(custom, (profile) =>
        profile.languages.some((l) => l.name === 'Rust' && l.percentage > 70) ? 80 : 0,
      );

      const profile = makeProfile({
        languages: [{ name: 'Rust', extensions: ['.rs'], fileCount: 100, percentage: 95 }],
      });
      const selected = selectTemplate(profile);
      expect(selected.id).toBe('rust-embedded');
    });
  });

  describe('loadCustomTemplatesFromConfig', () => {
    it('loads templates from config objects', () => {
      loadCustomTemplatesFromConfig([
        {
          id: 'config-template',
          name: 'Config Template',
          description: 'From config',
          userPrompt: 'Analyze the project: {{projectProfile}}\n\n{{nodeTypes}}',
        },
      ]);

      const t = getTemplateById('config-template');
      expect(t).toBeDefined();
      expect(t!.name).toBe('Config Template');
      expect(t!.analysisSteps.length).toBe(1);
    });
  });

  describe('Prompt output format', () => {
    it('templates produce prompts with {{placeholder}} tokens', () => {
      const templates = [
        generalTemplate,
        webAppTemplate,
        microservicesTemplate,
        dataPipelineTemplate,
      ];
      for (const t of templates) {
        const step = t.analysisSteps[0];
        // All templates should have projectProfile placeholder
        expect(step.userPrompt).toContain('{{projectProfile}}');
        // All templates should have fileContents placeholder
        expect(step.userPrompt).toContain('{{fileContents}}');
      }
    });

    it('templates include schema text in prompts', () => {
      const templates = [
        generalTemplate,
        webAppTemplate,
        microservicesTemplate,
        dataPipelineTemplate,
      ];
      for (const t of templates) {
        const step = t.analysisSteps[0];
        // Should include the schema definition
        expect(step.userPrompt).toContain('architectureName');
        expect(step.userPrompt).toContain('nodes');
        expect(step.userPrompt).toContain('edges');
      }
    });
  });

  describe('Template unique IDs', () => {
    it('all built-in templates have unique IDs', () => {
      const templates = listTemplates();
      const ids = templates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Depth guidance in legacy templates', () => {
    it('general template system prompt includes thoroughness guidance', () => {
      expect(generalTemplate.systemPrompt).toContain('thorough');
      expect(generalTemplate.systemPrompt).toContain('completeness over brevity');
    });

    it('general template system prompt includes parent-child guidance', () => {
      expect(generalTemplate.systemPrompt).toContain('parentId');
      expect(generalTemplate.systemPrompt).toContain('parent-child');
    });

    it('general template system prompt includes canvas-ref guidance', () => {
      expect(generalTemplate.systemPrompt).toContain('meta/canvas-ref');
    });

    it('general template user prompt includes depth guidelines section', () => {
      const prompt = generalTemplate.analysisSteps[0].userPrompt;
      expect(prompt).toContain('Depth & Thoroughness Guidelines');
      expect(prompt).toContain('15-50+ nodes');
      expect(prompt).toContain('meta/canvas-ref');
    });

    it('webApp template system prompt includes web-specific depth guidance', () => {
      expect(webAppTemplate.systemPrompt).toContain('thorough');
      expect(webAppTemplate.systemPrompt).toContain('route groups');
      expect(webAppTemplate.systemPrompt).toContain('middleware layers');
      expect(webAppTemplate.systemPrompt).toContain('parentId');
    });

    it('webApp template system prompt includes canvas-ref guidance', () => {
      expect(webAppTemplate.systemPrompt).toContain('meta/canvas-ref');
    });

    it('webApp template user prompt includes depth guidelines section', () => {
      const prompt = webAppTemplate.analysisSteps[0].userPrompt;
      expect(prompt).toContain('Depth Guidelines');
      expect(prompt).toContain('15-50+ nodes');
      expect(prompt).toContain('parentId');
    });

    it('webApp template user prompt mentions modeling children under backend', () => {
      const prompt = webAppTemplate.analysisSteps[0].userPrompt;
      expect(prompt).toContain('children');
      expect(prompt).toContain('route groups');
    });

    it('microservices template system prompt includes per-service internal guidance', () => {
      expect(microservicesTemplate.systemPrompt).toContain('thorough');
      expect(microservicesTemplate.systemPrompt).toContain('per-service internals');
      expect(microservicesTemplate.systemPrompt).toContain('parentId');
    });

    it('microservices template system prompt includes canvas-ref guidance', () => {
      expect(microservicesTemplate.systemPrompt).toContain('meta/canvas-ref');
    });

    it('microservices template user prompt includes depth guidelines section', () => {
      const prompt = microservicesTemplate.analysisSteps[0].userPrompt;
      expect(prompt).toContain('Depth Guidelines');
      expect(prompt).toContain('15-50+ nodes');
      expect(prompt).toContain('parentId');
    });

    it('microservices template user prompt mentions per-service internals', () => {
      const prompt = microservicesTemplate.analysisSteps[0].userPrompt;
      expect(prompt).toContain('Per-service internals');
      expect(prompt).toContain('children');
    });

    it('dataPipeline template system prompt includes pipeline stage depth guidance', () => {
      expect(dataPipelineTemplate.systemPrompt).toContain('thorough');
      expect(dataPipelineTemplate.systemPrompt).toContain('individual pipeline stages');
      expect(dataPipelineTemplate.systemPrompt).toContain('parentId');
    });

    it('dataPipeline template system prompt includes canvas-ref guidance', () => {
      expect(dataPipelineTemplate.systemPrompt).toContain('meta/canvas-ref');
    });

    it('dataPipeline template user prompt includes depth guidelines section', () => {
      const prompt = dataPipelineTemplate.analysisSteps[0].userPrompt;
      expect(prompt).toContain('Depth Guidelines');
      expect(prompt).toContain('15-50+ nodes');
      expect(prompt).toContain('parentId');
    });

    it('dataPipeline template user prompt mentions modeling individual stages', () => {
      const prompt = dataPipelineTemplate.analysisSteps[0].userPrompt;
      expect(prompt).toContain('individual stages');
      expect(prompt).toContain('children');
    });

    it('all templates include composite node guidance where appropriate', () => {
      const templates = [
        generalTemplate,
        webAppTemplate,
        microservicesTemplate,
        dataPipelineTemplate,
      ];
      for (const t of templates) {
        expect(t.systemPrompt).toContain('meta/canvas-ref');
        expect(t.systemPrompt).toContain('parentId');
        const prompt = t.analysisSteps[0].userPrompt;
        expect(prompt).toContain('meta/canvas-ref');
      }
    });
  });
});
