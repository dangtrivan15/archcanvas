/**
 * Adapter to convert MCP tool Zod schemas into Anthropic SDK tool_use format.
 *
 * The MCP TOOL_DEFINITIONS use flat Zod schema objects (Record<string, ZodType>).
 * The Anthropic SDK expects tools in the shape:
 *   { name, description, input_schema: { type: 'object', properties, required } }
 *
 * This module bridges the two formats using zod-to-json-schema.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';
import type { ToolRegistry } from './agentLoop';

/**
 * Convert a flat Zod schema object (like TOOL_DEFINITIONS[x].inputSchema)
 * into an Anthropic Tool.InputSchema (JSON Schema with type: 'object').
 *
 * @param zodFields - Record of field name → ZodType (e.g., { query: z.string(), ... })
 * @returns JSON Schema object compatible with Anthropic's input_schema
 */
export function zodFieldsToJsonSchema(
  zodFields: Record<string, z.ZodTypeAny>,
): Tool.InputSchema {
  // Wrap the flat fields into a z.object() so zod-to-json-schema can process it
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, value] of Object.entries(zodFields)) {
    shape[key] = value;
  }
  const objectSchema = z.object(shape);

  // Convert to JSON Schema
  const jsonSchema = zodToJsonSchema(objectSchema, {
    // Strip the $schema and $ref wrapper that zod-to-json-schema adds
    target: 'openApi3',
    // Don't add definitions
    $refStrategy: 'none',
  });

  // Ensure it matches Anthropic's expected shape
  return {
    type: 'object',
    properties: (jsonSchema as Record<string, unknown>).properties ?? {},
    required: (jsonSchema as Record<string, unknown>).required,
  } as Tool.InputSchema;
}

/**
 * Convert a ToolRegistry (Map<name, { description, inputSchema, handler }>) into
 * an array of Anthropic Tool definitions suitable for messages.create({ tools }).
 */
export function zodSchemasToAnthropicTools(registry: ToolRegistry): Tool[] {
  const tools: Tool[] = [];

  for (const [name, entry] of registry) {
    tools.push({
      name,
      description: entry.description,
      input_schema: zodFieldsToJsonSchema(entry.inputSchema),
    });
  }

  return tools;
}
