/**
 * Shared arg translation logic for ArchCanvas tools.
 *
 * Translates raw tool arguments (AI-facing shape) into dispatcher-ready format
 * (store-facing shape). Shared by both MCP server (mcpTools.ts) and
 * ApiKeyProvider (apiKeyProvider.ts).
 */

import { parseCanvas } from '../../storage/yamlCodec';

/** Map tool name → dispatcher action name */
export const TOOL_TO_ACTION: Record<string, string> = {
  add_node: 'addNode',
  add_edge: 'addEdge',
  remove_node: 'removeNode',
  remove_edge: 'removeEdge',
  import_yaml: 'import',
  create_subsystem: 'createSubsystem',
  add_entity: 'addEntity',
  remove_entity: 'removeEntity',
  update_entity: 'updateEntity',
  list: 'list',
  describe: 'describe',
  search: 'search',
  catalog: 'catalog',
};

const ROOT = '__root__';

/**
 * Translate raw tool args into dispatcher-ready format.
 * Handles: scope→canvasId, flat edge→nested edge, YAML→pre-parsed, etc.
 */
export function translateToolArgs(
  toolName: string,
  args: Record<string, unknown>,
): { action: string; translatedArgs: Record<string, unknown> } {
  const action = TOOL_TO_ACTION[toolName] ?? toolName;
  const scope = (args.scope as string) ?? ROOT;

  switch (toolName) {
    case 'add_node':
      return {
        action,
        translatedArgs: {
          canvasId: scope,
          id: args.id,
          type: args.type,
          name: args.name,
          args: args.args,
        },
      };

    case 'add_edge': {
      const edge: Record<string, unknown> = {
        from: { node: args.from, ...(args.fromPort ? { port: args.fromPort } : {}) },
        to: { node: args.to, ...(args.toPort ? { port: args.toPort } : {}) },
      };
      if (args.protocol) edge.protocol = args.protocol;
      if (args.label) edge.label = args.label;
      return { action, translatedArgs: { canvasId: scope, edge } };
    }

    case 'remove_node':
      return { action, translatedArgs: { canvasId: scope, nodeId: args.id as string } };

    case 'remove_edge':
      return { action, translatedArgs: { canvasId: scope, from: args.from, to: args.to } };

    case 'import_yaml': {
      const parsed = parseCanvas(args.yaml as string);
      return {
        action,
        translatedArgs: {
          canvasId: scope,
          nodes: parsed.data.nodes ?? [],
          edges: parsed.data.edges ?? [],
          entities: parsed.data.entities ?? [],
        },
      };
    }

    case 'create_subsystem':
      return {
        action,
        translatedArgs: { canvasId: scope, id: args.id, type: args.type, name: args.name },
      };

    case 'add_entity':
      return {
        action,
        translatedArgs: {
          canvasId: scope,
          name: args.name,
          ...(args.description !== undefined && { description: args.description }),
          ...(args.codeRefs !== undefined && { codeRefs: args.codeRefs }),
        },
      };

    case 'remove_entity':
      return { action, translatedArgs: { canvasId: scope, entityName: args.name } };

    case 'update_entity':
      return {
        action,
        translatedArgs: {
          canvasId: scope,
          entityName: args.name,
          ...(args.description !== undefined && { description: args.description }),
          ...(args.codeRefs !== undefined && { codeRefs: args.codeRefs }),
        },
      };

    // Read actions: map scope → canvasId, pass rest through
    default: {
      const { scope: _, ...rest } = args;
      return { action, translatedArgs: { ...rest, canvasId: scope } };
    }
  }
}
