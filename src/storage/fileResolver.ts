import type { Document } from 'yaml';
import type { FileSystem } from '../platform/fileSystem';
import type { CanvasFile } from '../types';
import { parseCanvasFile, serializeCanvasFile } from './yamlCodec';

export interface LoadedCanvas {
  filePath: string;
  data: CanvasFile;
  doc: Document | undefined;
}

export interface ResolvedProject {
  root: LoadedCanvas;
  canvases: Map<string, LoadedCanvas>;
  errors: ResolutionError[];
}

export interface ResolutionError {
  file: string;
  message: string;
}

export const ROOT_CANVAS_KEY = '__root__';

export async function loadProject(
  fs: FileSystem,
): Promise<ResolvedProject> {
  const errors: ResolutionError[] = [];
  const canvases = new Map<string, LoadedCanvas>();
  const loaded = new Set<string>(); // already loaded (skip re-loading)
  const ancestors = new Set<string>(); // current DFS path (detect cycles)

  const mainPath = '.archcanvas/main.yaml';
  const mainContent = await fs.readFile(mainPath);
  const mainParsed = parseCanvasFile(mainContent);

  const root: LoadedCanvas = {
    filePath: mainPath,
    data: mainParsed.data,
    doc: mainParsed.doc,
  };
  canvases.set(ROOT_CANVAS_KEY, root);

  await resolveRefs(fs, root, canvases, errors, loaded, ancestors);
  validateRootRefs(root, canvases, errors);

  return { root, canvases, errors };
}

async function resolveRefs(
  fs: FileSystem,
  canvas: LoadedCanvas,
  canvases: Map<string, LoadedCanvas>,
  errors: ResolutionError[],
  loaded: Set<string>,
  ancestors: Set<string>,
): Promise<void> {
  const nodes = canvas.data.nodes ?? [];

  for (const node of nodes) {
    if (!('ref' in node) || !node.ref) continue;

    const ref = node.ref;

    // True cycle: this ref is an ancestor in the current DFS path
    if (ancestors.has(ref)) {
      errors.push({
        file: canvas.filePath,
        message: `Circular reference detected: ${ref}`,
      });
      continue;
    }

    // Diamond: already loaded via a different path — skip, no error
    if (loaded.has(ref)) continue;

    // Mark as loaded before attempting read — if the file is missing or invalid,
    // only the first reference reports an error; subsequent references skip silently.
    loaded.add(ref);
    ancestors.add(ref);
    const filePath = `.archcanvas/${ref}.yaml`;

    try {
      const content = await fs.readFile(filePath);
      const parsed = parseCanvasFile(content);
      const loadedCanvas: LoadedCanvas = {
        filePath,
        data: parsed.data,
        doc: parsed.doc,
      };
      canvases.set(ref, loadedCanvas);

      await resolveRefs(fs, loadedCanvas, canvases, errors, loaded, ancestors);
    } catch (err) {
      errors.push({
        file: canvas.filePath,
        message: `Failed to load ref '${ref}': ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    ancestors.delete(ref); // backtrack
  }
}

function validateRootRefs(
  root: LoadedCanvas,
  canvases: Map<string, LoadedCanvas>,
  errors: ResolutionError[],
): void {
  const rootNodeIds = new Set(
    (root.data.nodes ?? []).map((n) => n.id),
  );

  for (const [id, canvas] of canvases) {
    if (id === ROOT_CANVAS_KEY) continue;

    for (const edge of canvas.data.edges ?? []) {
      for (const endpoint of [edge.from, edge.to]) {
        if (endpoint.node.startsWith('@root/')) {
          const refId = endpoint.node.slice('@root/'.length);
          if (!rootNodeIds.has(refId)) {
            errors.push({
              file: canvas.filePath,
              message: `@root/ reference '${refId}' not found in root canvas`,
            });
          }
        }
      }
    }
  }
}

export async function saveCanvas(
  fs: FileSystem,
  canvas: LoadedCanvas,
): Promise<void> {
  const yamlString = serializeCanvasFile(canvas.data, canvas.doc);
  await fs.writeFile(canvas.filePath, yamlString);
}
