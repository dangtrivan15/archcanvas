/**
 * Zod schema validation for NodeDef structures.
 * Validates nodedef data at API boundaries.
 */

import { z } from 'zod';

export const argDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'enum', 'duration']),
  description: z.string(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const portDefSchema = z.object({
  name: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']),
  protocol: z.array(z.string()),
  description: z.string().optional(),
  condition: z.string().optional(),
});

export const childSlotDefSchema = z.object({
  nodedef: z.string().min(1),
  min: z.number().int().min(0),
  max: z.number().int().min(0),
});

export const variantDefSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  args: z.record(z.union([z.string(), z.number(), z.boolean()])),
});

export const nodeDefSpecSchema = z.object({
  args: z.array(argDefSchema),
  ports: z.array(portDefSchema),
  children: z.array(childSlotDefSchema).optional(),
  ai: z
    .object({
      context: z.string().optional(),
      reviewHints: z.array(z.string()).optional(),
    })
    .optional(),
});

export const nodeDefShapeSchema = z.enum([
  'rectangle',
  'cylinder',
  'hexagon',
  'parallelogram',
  'cloud',
  'stadium',
  'document',
  'badge',
  'container',
]);

export const nodeDefMetadataSchema = z.object({
  name: z.string().min(1),
  namespace: z.string().min(1),
  version: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  icon: z.string().min(1),
  tags: z.array(z.string()),
  author: z.string().optional(),
  shape: nodeDefShapeSchema.optional(),
});

export const nodeDefSchema = z.object({
  kind: z.literal('NodeDef'),
  apiVersion: z.string().min(1),
  metadata: nodeDefMetadataSchema,
  spec: nodeDefSpecSchema,
  variants: z.array(variantDefSchema).optional(),
});

export type ValidatedNodeDef = z.infer<typeof nodeDefSchema>;

/**
 * Validates a nodedef object against the schema.
 * Returns the validated nodedef or throws with details.
 */
export function validateNodeDef(data: unknown): ValidatedNodeDef {
  return nodeDefSchema.parse(data);
}

/**
 * Validates a nodedef object, returning a result instead of throwing.
 */
export function safeValidateNodeDef(
  data: unknown,
): { success: true; data: ValidatedNodeDef } | { success: false; error: z.ZodError } {
  const result = nodeDefSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
