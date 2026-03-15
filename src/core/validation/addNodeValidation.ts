import type { NodeDef } from '@/types/nodeDefSchema';
import type { InlineNode } from '@/types/schema';

// ---------------------------------------------------------------------------
// Public interface — minimal registry contract (no Zustand dependency)
// ---------------------------------------------------------------------------

/** Minimal registry interface for addNode validation (no Zustand dependency). */
export interface NodeDefLookup {
  resolve(type: string): NodeDef | undefined;
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export type AddNodeInput = {
  id: string;
  type: string;
  name?: string;
  args?: string;
};

export type AddNodeResult =
  | { ok: true; node: InlineNode; resolvedType: string }
  | { ok: false; code: string; message: string };

// ---------------------------------------------------------------------------
// Pure validation + node construction
// ---------------------------------------------------------------------------

/**
 * Validates a node type against the registry, resolves displayName, parses
 * args JSON, and returns either a ready-to-use InlineNode or a structured
 * error with hints/suggestions.
 *
 * This function is **pure** — it reads from the provided `registry` lookup
 * but performs no side effects (no store mutations, no I/O).
 */
export function validateAndBuildNode(
  input: AddNodeInput,
  registry: NodeDefLookup,
): AddNodeResult {
  let { type } = input;

  // 1. Resolve type (direct match)
  let nodeDef = registry.resolve(type);

  // 2. Dot→slash substitution (e.g., "compute.service" → "compute/service")
  if (!nodeDef && type.includes('.')) {
    const slashVariant = type.replaceAll('.', '/');
    nodeDef = registry.resolve(slashVariant);
    if (nodeDef) {
      type = slashVariant;
    }
  }

  // 3. If still not found, build hint message with fuzzy search
  if (!nodeDef) {
    const hints: string[] = [
      `Node type '${type}' is not registered.`,
      `Node types use the format \`namespace/name\` (e.g., compute/service).`,
    ];

    // Search by each word in name/displayName/description/tags
    const words = type.split(/[/.]/);
    const candidates = new Map<string, NodeDef>();

    for (const word of words) {
      if (word.length === 0) continue;
      for (const def of registry.search(word)) {
        const key = `${def.metadata.namespace}/${def.metadata.name}`;
        candidates.set(key, def);
      }
    }

    // Also try namespace-based lookup (first word might be the namespace)
    if (words.length >= 1 && words[0].length > 0) {
      for (const def of registry.listByNamespace(words[0])) {
        const key = `${def.metadata.namespace}/${def.metadata.name}`;
        candidates.set(key, def);
      }
    }

    const similar = Array.from(candidates.values()).slice(0, 3);
    if (similar.length > 0) {
      const names = similar.map(
        (d) => `${d.metadata.namespace}/${d.metadata.name}`,
      );
      hints.push(`Similar types: ${names.join(', ')}`);
    }

    // Suggest the dot→slash variant if input contained '.'
    if (input.type.includes('.')) {
      const slashVariant = input.type.replaceAll('.', '/');
      hints.push(`Did you mean '${slashVariant}'?`);
    }

    hints.push(`Run \`archcanvas catalog --json\` to see all available types.`);

    return { ok: false, code: 'UNKNOWN_NODE_TYPE', message: hints.join(' ') };
  }

  // 4. Parse args JSON if provided
  let parsedArgs: Record<string, string | number | boolean | string[]> | undefined;
  if (input.args) {
    try {
      parsedArgs = JSON.parse(input.args);
    } catch {
      return {
        ok: false,
        code: 'INVALID_ARGS',
        message: `Invalid JSON for --args: ${input.args}`,
      };
    }
  }

  // 5. Resolve displayName
  const displayName = input.name ?? nodeDef.metadata.displayName;

  // 6. Construct InlineNode
  const node: InlineNode = {
    id: input.id,
    type,
    displayName,
    args: parsedArgs,
  };

  return { ok: true, node, resolvedType: type };
}
