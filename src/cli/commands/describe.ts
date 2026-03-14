import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import { loadContext, resolveCanvasId, bridgeRequest } from '../context';
import { CLIError } from '../errors';
import type { OutputOptions } from '../output';
import { printSuccess } from '../output';
import type { Edge } from '@/types';

export interface DescribeFlags {
  id?: string;
  scope?: string;
}

export async function describeCommand(flags: DescribeFlags, options: OutputOptions, projectPath?: string): Promise<void> {
  const ctx = await loadContext(projectPath);

  if (ctx.bridgeUrl) {
    const result = await bridgeRequest(ctx.bridgeUrl, 'describe', {
      canvasId: resolveCanvasId(flags.scope),
      id: flags.id,
    });
    printSuccess(result.data ?? result, options);
    return;
  }
  if (flags.id) {
    describeNode(flags.id, flags.scope, options);
  } else {
    describeArchitecture(options);
  }
}

function describeNode(nodeId: string, scope: string | undefined, options: OutputOptions): void {
  const canvasId = resolveCanvasId(scope);
  const canvas = useFileStore.getState().getCanvas(canvasId);

  if (!canvas) {
    throw new CLIError('CANVAS_NOT_FOUND', `Canvas '${canvasId}' not found.`);
  }

  const nodes = canvas.data.nodes ?? [];
  const node = nodes.find((n) => n.id === nodeId);

  if (!node) {
    throw new CLIError('NODE_NOT_FOUND', `Node '${nodeId}' not found in canvas '${canvasId}'.`);
  }

  const edges = canvas.data.edges ?? [];
  const connectedEdges = edges.filter(
    (e: Edge) => e.from.node === nodeId || e.to.node === nodeId,
  );

  const result: Record<string, unknown> = {
    id: node.id,
  };

  if ('type' in node) {
    result.type = node.type;
    result.displayName = node.displayName;
    result.args = node.args;
    result.notes = node.notes;
    result.codeRefs = node.codeRefs;

    // Resolve ports from NodeDef registry
    const nodeDef = useRegistryStore.getState().resolve(node.type);
    if (nodeDef) {
      result.ports = nodeDef.spec.ports;
    }
  } else if ('ref' in node) {
    result.ref = node.ref;
  }

  result.connectedEdges = connectedEdges.map((e: Edge) => ({
    from: e.from.node,
    to: e.to.node,
    label: e.label,
    protocol: e.protocol,
  }));

  printSuccess({ node: result }, options);
}

function describeArchitecture(options: OutputOptions): void {
  const project = useFileStore.getState().project;

  if (!project) {
    throw new CLIError('PROJECT_LOAD_FAILED', 'No project loaded.');
  }

  const rootCanvas = project.canvases.get(ROOT_CANVAS_KEY);
  const projectName = rootCanvas?.data.project?.name ?? 'Unknown';

  const scopes: Record<string, unknown>[] = [];

  for (const [canvasId, canvas] of project.canvases) {
    const data = canvas.data;
    const scopeInfo: Record<string, unknown> = {
      canvasId,
      nodeCount: (data.nodes ?? []).length,
      edgeCount: (data.edges ?? []).length,
      entityCount: (data.entities ?? []).length,
    };

    // For ref nodes with children, include child canvas counts
    if (canvasId !== ROOT_CANVAS_KEY) {
      const refNodes = (data.nodes ?? []).filter((n) => 'ref' in n);
      if (refNodes.length > 0) {
        scopeInfo.childRefs = refNodes.map((n) => {
          const ref = 'ref' in n ? n.ref : '';
          const childCanvas = project.canvases.get(ref);
          return {
            ref,
            nodeCount: childCanvas ? (childCanvas.data.nodes ?? []).length : 0,
            edgeCount: childCanvas ? (childCanvas.data.edges ?? []).length : 0,
          };
        });
      }
    }

    scopes.push(scopeInfo);
  }

  printSuccess({
    project: projectName,
    scopes,
  }, options);
}
