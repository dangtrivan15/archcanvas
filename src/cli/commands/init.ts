import { resolve, basename } from 'node:path';
import { createFileSystem } from '../../platform/index';
import { CLIError } from '../errors';
import { formatSuccess, type OutputOptions } from '../output';

export interface InitOptions {
  name?: string;
  path?: string;
}

/**
 * Initialize a new ArchCanvas project.
 *
 * Creates `.archcanvas/main.yaml` at the target path with a starter template.
 * Does NOT use loadContext() — there's no existing project to load (C11.3).
 */
export async function initCommand(
  options: InitOptions,
  globalOptions: OutputOptions,
): Promise<void> {
  const targetPath = resolve(options.path ?? process.cwd());
  const projectName = options.name ?? basename(targetPath);

  const fs = await createFileSystem(targetPath);

  // C5a.3: Error if already initialized
  if (await fs.exists('.archcanvas/main.yaml')) {
    throw new CLIError(
      'PROJECT_EXISTS',
      `Project already initialized at ${targetPath}`,
    );
  }

  // C5a.1: Create .archcanvas/ directory
  await fs.mkdir('.archcanvas');

  // C5a.2: Create main.yaml with template
  const template = `project:
  name: ${projectName}
  description: ""
  version: "1.0.0"

nodes: []
edges: []
entities: []
`;

  await fs.writeFile('.archcanvas/main.yaml', template);

  // C5a.4: Human output — clean message
  // C5a.5: JSON output — { ok: true, project: { name, path } }
  if (globalOptions.json) {
    process.stdout.write(
      formatSuccess({ project: { name: projectName, path: targetPath } }, globalOptions) + '\n',
    );
  } else {
    process.stdout.write(`Initialized project '${projectName}' at ${targetPath}\n`);
  }
}
