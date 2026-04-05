import { describe, it, expect } from 'vitest';
import { applyTemplate } from '@/core/templates/apply';
import { getTemplateById } from '@/core/templates/loader';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { parseCanvas } from '@/storage/yamlCodec';

describe('applyTemplate', () => {
  it('creates .archcanvas directory and main.yaml', async () => {
    const fs = new InMemoryFileSystem('TestProject');
    const template = getTemplateById('microservices')!;

    await applyTemplate(fs, template);

    expect(await fs.exists('.archcanvas')).toBe(true);
    expect(await fs.exists('.archcanvas/main.yaml')).toBe(true);
  });

  it('writes valid YAML that can be parsed', async () => {
    const fs = new InMemoryFileSystem('TestProject');
    const template = getTemplateById('microservices')!;

    await applyTemplate(fs, template);

    const content = await fs.readFile('.archcanvas/main.yaml');
    const { data } = parseCanvas(content);

    expect(data.project).toBeDefined();
    expect(data.project!.name).toBe('TestProject');
    expect(data.nodes!.length).toBeGreaterThan(0);
    expect(data.edges!.length).toBeGreaterThan(0);
  });

  it('uses the filesystem name as the project name', async () => {
    const fs = new InMemoryFileSystem('MyAwesomeProject');
    const template = getTemplateById('serverless')!;

    await applyTemplate(fs, template);

    const content = await fs.readFile('.archcanvas/main.yaml');
    const { data } = parseCanvas(content);

    expect(data.project!.name).toBe('MyAwesomeProject');
  });

  it('preserves all template nodes', async () => {
    const fs = new InMemoryFileSystem('Test');
    const template = getTemplateById('microservices')!;

    await applyTemplate(fs, template);

    const content = await fs.readFile('.archcanvas/main.yaml');
    const { data } = parseCanvas(content);

    expect(data.nodes).toHaveLength(template.canvas.nodes!.length);
  });

  it('preserves all template edges', async () => {
    const fs = new InMemoryFileSystem('Test');
    const template = getTemplateById('microservices')!;

    await applyTemplate(fs, template);

    const content = await fs.readFile('.archcanvas/main.yaml');
    const { data } = parseCanvas(content);

    expect(data.edges).toHaveLength(template.canvas.edges!.length);
  });

  it('preserves all template entities', async () => {
    const fs = new InMemoryFileSystem('Test');
    const template = getTemplateById('microservices')!;

    await applyTemplate(fs, template);

    const content = await fs.readFile('.archcanvas/main.yaml');
    const { data } = parseCanvas(content);

    expect(data.entities).toHaveLength(template.canvas.entities!.length);
  });

  it('does not fail if .archcanvas already exists', async () => {
    const fs = new InMemoryFileSystem('Test');
    await fs.mkdir('.archcanvas');

    const template = getTemplateById('monolith')!;
    await expect(applyTemplate(fs, template)).resolves.not.toThrow();
  });

  it('works for every template', async () => {
    const { getAllTemplates } = await import('@/core/templates/loader');

    for (const template of getAllTemplates()) {
      const fs = new InMemoryFileSystem('Test');
      await applyTemplate(fs, template);

      const content = await fs.readFile('.archcanvas/main.yaml');
      const { data } = parseCanvas(content);

      expect(data.project).toBeDefined();
      expect(data.nodes!.length).toBeGreaterThan(0);
    }
  });
});
