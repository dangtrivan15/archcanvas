import type { FileSystem } from '../../platform/fileSystem';
import type { ArchTemplate } from './schema';
import { serializeCanvas } from '../../storage/yamlCodec';

/**
 * Write a template's canvas data to disk as a new project.
 *
 * Creates `.archcanvas/main.yaml` with the template's nodes, edges, and
 * entities wrapped in a root canvas with project metadata.
 *
 * The caller is responsible for calling `loadProject(fs)` afterwards to
 * populate the project store from the written YAML.
 */
export async function applyTemplate(
  fs: FileSystem,
  template: ArchTemplate,
): Promise<void> {
  // Ensure .archcanvas/ exists
  if (!(await fs.exists('.archcanvas'))) {
    await fs.mkdir('.archcanvas');
  }

  const projectName = fs.getName() || template.name;

  const yaml = serializeCanvas({
    project: {
      name: projectName,
      description: template.description,
      version: '1.0.0',
    },
    nodes: template.canvas.nodes ?? [],
    edges: template.canvas.edges ?? [],
    entities: template.canvas.entities ?? [],
  });

  await fs.writeFile('.archcanvas/main.yaml', yaml);
}
