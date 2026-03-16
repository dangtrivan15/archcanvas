import type { Document } from 'yaml';
import type { FileSystem } from '../platform/fileSystem';
import type { Canvas } from '../types';
import { parseCanvas, serializeCanvas } from './yamlCodec';

export interface LoadedCanvas {
  filePath: string;
  data: Canvas;
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
  const mainParsed = parseCanvas(mainContent);

  const root: LoadedCanvas = {
    filePath: mainPath,
    data: mainParsed.data,
    doc: mainParsed.doc,
  };
  canvases.set(ROOT_CANVAS_KEY, root);

  await resolveRefs(fs, root, canvases, errors, loaded, ancestors);
  validateCrossScopeRefs(canvases, root, errors);

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
    const filePath = `.archcanvas/${ref}`;

    // True cycle: this file is an ancestor in the current DFS path
    if (ancestors.has(filePath)) {
      errors.push({
        file: canvas.filePath,
        message: `Circular reference detected: ${ref}`,
      });
      continue;
    }

    // Diamond: already loaded via a different path — skip, no error
    if (loaded.has(filePath)) continue;

    // Mark as loaded before attempting read — if the file is missing or invalid,
    // only the first reference reports an error; subsequent references skip silently.
    loaded.add(filePath);
    ancestors.add(filePath);

    try {
      const content = await fs.readFile(filePath);
      const parsed = parseCanvas(content);
      const loadedCanvas: LoadedCanvas = {
        filePath,
        data: parsed.data,
        doc: parsed.doc,
      };
      canvases.set(node.id, loadedCanvas);

      await resolveRefs(fs, loadedCanvas, canvases, errors, loaded, ancestors);
    } catch (err) {
      errors.push({
        file: canvas.filePath,
        message: `Failed to load ref '${ref}': ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    ancestors.delete(filePath); // backtrack
  }
}

function validateCrossScopeRefs(
  canvases: Map<string, LoadedCanvas>,
  root: LoadedCanvas,
  errors: ResolutionError[],
): void {
  const allCanvases = new Map(canvases);
  allCanvases.set(ROOT_CANVAS_KEY, root);

  for (const [canvasId, canvas] of allCanvases) {
    for (const edge of canvas.data.edges ?? []) {
      for (const side of ['from', 'to'] as const) {
        const endpoint = edge[side];
        if (!endpoint.node.startsWith('@')) continue;

        const slashIdx = endpoint.node.indexOf('/');
        if (slashIdx === -1) {
          errors.push({
            file: canvas.filePath,
            message: `Invalid cross-scope ref '${endpoint.node}' in canvas '${canvasId}' — missing /nodeId`,
          });
          continue;
        }

        const refNodeId = endpoint.node.slice(1, slashIdx);
        const targetNodeId = endpoint.node.slice(slashIdx + 1);

        // Check ref-node-id exists in this canvas's nodes
        const nodes = canvas.data.nodes ?? [];
        const refNode = nodes.find(
          (n) => n.id === refNodeId && 'ref' in n,
        );
        if (!refNode) {
          // Engine validates this at edge-add time too (CROSS_SCOPE_REF_NOT_FOUND)
          // Here we just check the target node exists
          continue;
        }

        // Check target node exists in the referenced canvas
        const targetCanvas = canvases.get(refNodeId);
        if (!targetCanvas) {
          errors.push({
            file: canvas.filePath,
            message: `Cross-scope ref '@${refNodeId}/${targetNodeId}' — canvas '${refNodeId}' not loaded`,
          });
          continue;
        }

        const targetNodes = targetCanvas.data.nodes ?? [];
        if (!targetNodes.some((n) => n.id === targetNodeId)) {
          errors.push({
            file: canvas.filePath,
            message: `Cross-scope ref '@${refNodeId}/${targetNodeId}' — node '${targetNodeId}' not found in canvas '${refNodeId}'`,
          });
        }
      }
    }
  }
}

export async function saveCanvas(
  fs: FileSystem,
  canvas: LoadedCanvas,
): Promise<void> {
  const yamlString = serializeCanvas(canvas.data, canvas.doc);
  await fs.writeFile(canvas.filePath, yamlString);
}
