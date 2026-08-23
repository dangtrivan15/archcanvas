/**
 * Per-provider tool-schema converters.
 *
 * `archCanvasToolDefs` (toolDefs.ts) is the single neutral tool catalogue,
 * defined as Zod schemas. This module converts it into the two shapes the
 * new providers need:
 *   - `toOpenAiTools` — OpenAI Chat Completions `tools[]` envelope (also
 *     used by OllamaProvider, since Ollama exposes an OpenAI-compatible
 *     endpoint).
 *   - `toGeminiFunctionDeclarations` — Gemini `functionDeclarations[]`,
 *     sanitized to Gemini's restricted, OpenAPI-3.0-based JSON Schema
 *     subset (see Caveat 8 in the spec).
 *
 * The Anthropic side (apiKeyProvider.ts) already converts inline with
 * `z.toJSONSchema` — same primitive, no sanitization needed there because
 * Anthropic accepts full JSON Schema 2020-12 output as-is.
 */

import { z } from 'zod/v4';
import { archCanvasToolDefs, type ToolDef } from '../toolDefs';

// ---------------------------------------------------------------------------
// OpenAI (and Ollama, via its OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------

export interface OpenAiToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface OpenAiTool {
  type: 'function';
  function: OpenAiToolFunction;
}

/** Convert the neutral tool catalogue into OpenAI Chat Completions `tools[]`. */
export function toOpenAiTools(defs: ToolDef[] = archCanvasToolDefs): OpenAiTool[] {
  return defs.map((def) => ({
    type: 'function',
    function: {
      name: def.name,
      description: def.description,
      parameters: z.toJSONSchema(def.inputSchema) as Record<string, unknown>,
    },
  }));
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Keys that `z.toJSONSchema`'s default JSON Schema 2020-12 output may
 * include but that Gemini's `functionDeclarations[].parameters` validator
 * (a restricted, OpenAPI-3.0-based subset) rejects — e.g. `$schema` (always
 * present at the schema root). Stripped recursively so nested `properties`/
 * `items` objects are sanitized too. See spec Caveat 8.
 */
const GEMINI_UNSUPPORTED_KEYS = new Set<string>([
  '$schema',
  '$id',
  '$comment',
  '$defs',
  '$ref',
  'additionalProperties',
  'const',
  'examples',
  'contentEncoding',
  'contentMediaType',
  'if',
  'then',
  'else',
  'unevaluatedProperties',
  'unevaluatedItems',
  'prefixItems',
]);

function sanitizeForGemini(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeForGemini);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (GEMINI_UNSUPPORTED_KEYS.has(key)) continue;
      result[key] = sanitizeForGemini(v);
    }
    return result;
  }
  return value;
}

/** Convert the neutral tool catalogue into Gemini `functionDeclarations[]`. */
export function toGeminiFunctionDeclarations(
  defs: ToolDef[] = archCanvasToolDefs,
): GeminiFunctionDeclaration[] {
  return defs.map((def) => ({
    name: def.name,
    description: def.description,
    parameters: sanitizeForGemini(z.toJSONSchema(def.inputSchema)) as Record<string, unknown>,
  }));
}
