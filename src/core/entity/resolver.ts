import type { ResolvedProject, LoadedCanvas } from '../../storage/fileResolver';
import type { Edge, Entity } from '../../types/schema';
import { ROOT_CANVAS_KEY } from '../../storage/fileResolver';

export interface EntityUsage {
  canvasId: string;
  canvasDisplayName: string;
  edges: Edge[];
}

export interface EntitySummary {
  name: string;
  description?: string;
  definedIn: string[];
  referencedIn: string[];
}

function getCanvasById(project: ResolvedProject, canvasId: string): LoadedCanvas | undefined {
  if (canvasId === ROOT_CANVAS_KEY) return project.root;
  return project.canvases.get(canvasId);
}

export function getEntitiesForCanvas(project: ResolvedProject, canvasId: string): Entity[] {
  const canvas = getCanvasById(project, canvasId);
  return (canvas?.data.entities ?? []) as Entity[];
}

function* allCanvases(project: ResolvedProject): Iterable<[string, LoadedCanvas]> {
  yield [ROOT_CANVAS_KEY, project.root];
  for (const [id, canvas] of project.canvases) {
    yield [id, canvas];
  }
}

export function findEntityUsages(project: ResolvedProject, entityName: string): EntityUsage[] {
  const usages: EntityUsage[] = [];
  for (const [canvasId, canvas] of allCanvases(project)) {
    const matchingEdges = (canvas.data.edges ?? []).filter(
      (e: Edge) => e.entities?.includes(entityName),
    );
    if (matchingEdges.length > 0) {
      usages.push({
        canvasId,
        canvasDisplayName: canvas.data.displayName ?? canvasId,
        edges: matchingEdges,
      });
    }
  }
  return usages;
}

export function listAllEntities(project: ResolvedProject): EntitySummary[] {
  const entityMap = new Map<string, EntitySummary>();

  for (const [canvasId, canvas] of allCanvases(project)) {
    // Collect definitions
    for (const entity of (canvas.data.entities ?? []) as Entity[]) {
      if (!entityMap.has(entity.name)) {
        entityMap.set(entity.name, {
          name: entity.name,
          description: entity.description,
          definedIn: [],
          referencedIn: [],
        });
      }
      entityMap.get(entity.name)!.definedIn.push(canvasId);
    }
    // Collect references from edges
    for (const edge of (canvas.data.edges ?? []) as Edge[]) {
      for (const entityName of edge.entities ?? []) {
        if (!entityMap.has(entityName)) {
          entityMap.set(entityName, {
            name: entityName,
            definedIn: [],
            referencedIn: [],
          });
        }
        const summary = entityMap.get(entityName)!;
        if (!summary.referencedIn.includes(canvasId)) {
          summary.referencedIn.push(canvasId);
        }
      }
    }
  }
  return Array.from(entityMap.values());
}
