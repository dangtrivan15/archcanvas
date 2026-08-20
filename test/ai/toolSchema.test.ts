import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { toOpenAiTools, toGeminiFunctionDeclarations } from '../../src-web/core/ai/providers/toolSchema';
import { archCanvasToolDefs, type ToolDef } from '../../src-web/core/ai/toolDefs';

// ---------------------------------------------------------------------------
// Recursively collect every key present anywhere in a JSON-schema-ish value.
// ---------------------------------------------------------------------------
function collectKeys(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out.add(key);
      collectKeys(v, out);
    }
  }
  return out;
}

describe('toOpenAiTools', () => {
  const tools = toOpenAiTools();

  it('emits one entry per archCanvasToolDefs tool', () => {
    expect(tools).toHaveLength(archCanvasToolDefs.length);
    expect(tools.length).toBe(20);
  });

  it('every entry has the OpenAI function-tool envelope', () => {
    for (const tool of tools) {
      expect(tool.type).toBe('function');
      expect(typeof tool.function.name).toBe('string');
      expect(typeof tool.function.description).toBe('string');
      expect(typeof tool.function.parameters).toBe('object');
    }
  });

  it('names and descriptions match the source tool defs', () => {
    const byName = new Map(tools.map((t) => [t.function.name, t]));
    for (const def of archCanvasToolDefs) {
      const tool = byName.get(def.name);
      expect(tool).toBeDefined();
      expect(tool!.function.description).toBe(def.description);
    }
  });

  it('snapshot: add_node tool shape', () => {
    const addNode = tools.find((t) => t.function.name === 'add_node')!;
    expect(addNode).toMatchInlineSnapshot(`
      {
        "function": {
          "description": "Add a node to the architecture canvas",
          "name": "add_node",
          "parameters": {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "additionalProperties": false,
            "properties": {
              "args": {
                "description": "Constructor arguments as JSON string",
                "type": "string",
              },
              "id": {
                "description": "Unique node identifier (kebab-case)",
                "type": "string",
              },
              "name": {
                "description": "Display name",
                "type": "string",
              },
              "scope": {
                "description": "Canvas scope ID (omit for root)",
                "type": "string",
              },
              "type": {
                "description": "Node type (e.g., compute/service, data/database). Run catalog tool first.",
                "type": "string",
              },
            },
            "required": [
              "id",
              "type",
            ],
            "type": "object",
          },
        },
        "type": "function",
      }
    `);
  });

  it('parameters are valid (non-empty) JSON Schema objects', () => {
    for (const tool of tools) {
      const params = tool.function.parameters as Record<string, unknown>;
      expect(params.type).toBe('object');
      expect(params.properties).toBeTypeOf('object');
    }
  });
});

describe('toGeminiFunctionDeclarations', () => {
  const decls = toGeminiFunctionDeclarations();

  it('emits one entry per archCanvasToolDefs tool', () => {
    expect(decls).toHaveLength(archCanvasToolDefs.length);
    expect(decls.length).toBe(20);
  });

  it('every entry has name/description/parameters', () => {
    for (const decl of decls) {
      expect(typeof decl.name).toBe('string');
      expect(typeof decl.description).toBe('string');
      expect(typeof decl.parameters).toBe('object');
    }
  });

  it('names and descriptions match the source tool defs', () => {
    const byName = new Map(decls.map((d) => [d.name, d]));
    for (const def of archCanvasToolDefs) {
      const decl = byName.get(def.name);
      expect(decl).toBeDefined();
      expect(decl!.description).toBe(def.description);
    }
  });

  it('never contains $schema anywhere in the emitted schema (recursively)', () => {
    for (const decl of decls) {
      const keys = collectKeys(decl.parameters);
      expect(keys.has('$schema')).toBe(false);
    }
  });

  it('never contains other JSON-Schema-2020-12-only keywords Gemini rejects', () => {
    const rejected = [
      '$id',
      '$comment',
      '$defs',
      'additionalProperties',
      'const',
      'examples',
      'contentEncoding',
      'contentMediaType',
      'unevaluatedProperties',
      'unevaluatedItems',
      'prefixItems',
    ];
    for (const decl of decls) {
      const keys = collectKeys(decl.parameters);
      for (const key of rejected) {
        expect(keys.has(key)).toBe(false);
      }
    }
  });

  it('preserves allowed keywords (type, properties, required, description)', () => {
    const addEdge = decls.find((d) => d.name === 'add_edge')!;
    const params = addEdge.parameters as Record<string, unknown>;
    expect(params.type).toBe('object');
    expect(params.properties).toBeTypeOf('object');
    expect(params.required).toEqual(['from', 'to']);
  });

  it('sanitizes nested properties too, not just the schema root', () => {
    // import_yaml has a plain string field; verify no unsupported keys leak
    // in from nested property schemas for any tool (not just the root).
    for (const decl of decls) {
      const props = (decl.parameters as { properties?: Record<string, unknown> }).properties ?? {};
      for (const propSchema of Object.values(props)) {
        const nestedKeys = collectKeys(propSchema);
        expect(nestedKeys.has('$schema')).toBe(false);
        expect(nestedKeys.has('additionalProperties')).toBe(false);
      }
    }
  });

  it('strips unsupported keywords from GENUINELY NESTED schemas (recursion), preserving enum', () => {
    // The real tool catalogue is entirely flat, so the "sanitizes nested
    // properties" test above can pass even if the sanitizer never recursed.
    // This uses a synthetic def with a nested object + array-of-object schema,
    // where z.toJSONSchema emits `additionalProperties` DEEP inside the tree.
    const nestedSchema = z.object({
      config: z.object({ level: z.enum(['low', 'high']) }),
      items: z.array(z.object({ label: z.string() })),
    });
    const nestedDef = {
      name: 'nested_probe',
      description: 'A tool whose schema is genuinely nested',
      inputSchema: nestedSchema,
    } as unknown as ToolDef;

    // Precondition (guards against a vacuous pass): the RAW schema really does
    // carry an unsupported keyword nested inside `config`.
    const raw = z.toJSONSchema(nestedSchema) as { properties: Record<string, unknown> };
    expect(collectKeys(raw.properties.config).has('additionalProperties')).toBe(true);

    const [decl] = toGeminiFunctionDeclarations([nestedDef]);
    const params = decl.parameters as {
      properties: { config: { type: string; properties: { level: { enum: string[] } } }; items: { items: unknown } };
    };

    // Every nested occurrence of an unsupported key is gone…
    expect(collectKeys(params).has('additionalProperties')).toBe(false);
    expect(collectKeys(params).has('$schema')).toBe(false);
    // …including inside the array's item object (a second level of nesting)…
    expect(collectKeys(params.properties.items.items).has('additionalProperties')).toBe(false);
    // …while a valid, nested `enum` keyword is preserved.
    expect(params.properties.config.type).toBe('object');
    expect(params.properties.config.properties.level.enum).toEqual(['low', 'high']);
  });

  it('snapshot: add_node function declaration shape', () => {
    const addNode = decls.find((d) => d.name === 'add_node')!;
    expect(addNode).toMatchInlineSnapshot(`
      {
        "description": "Add a node to the architecture canvas",
        "name": "add_node",
        "parameters": {
          "properties": {
            "args": {
              "description": "Constructor arguments as JSON string",
              "type": "string",
            },
            "id": {
              "description": "Unique node identifier (kebab-case)",
              "type": "string",
            },
            "name": {
              "description": "Display name",
              "type": "string",
            },
            "scope": {
              "description": "Canvas scope ID (omit for root)",
              "type": "string",
            },
            "type": {
              "description": "Node type (e.g., compute/service, data/database). Run catalog tool first.",
              "type": "string",
            },
          },
          "required": [
            "id",
            "type",
          ],
          "type": "object",
        },
      }
    `);
  });

  it('accepts a custom defs array (not just the default catalogue)', () => {
    const customDefs = archCanvasToolDefs.slice(0, 2);
    const customDecls = toGeminiFunctionDeclarations(customDefs);
    expect(customDecls).toHaveLength(2);
  });
});
