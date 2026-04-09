import { z } from 'zod/v4';
import { PropertyMap } from './schema';

// --- Enums ---

export const ArgType = z.enum(['string', 'number', 'boolean', 'enum', 'duration']);
export type ArgType = z.infer<typeof ArgType>;

export const PortDirection = z.enum(['inbound', 'outbound']);
export type PortDirection = z.infer<typeof PortDirection>;

export const BuiltinShapeName = z.enum([
  'rectangle',
  'cylinder',
  'hexagon',
  'parallelogram',
  'cloud',
  'stadium',
  'document',
  'badge',
  'container',
  'diamond',
  'trapezoid',
  'octagon',
  'pentagon',
  'arrow-right',
  'rounded-rect',
]);
export type BuiltinShapeName = z.infer<typeof BuiltinShapeName>;

/**
 * Regex for valid CSS clip-path function values.
 * Accepts polygon(), circle(), ellipse(), inset(), and path().
 * Rejects url() references — they are stripped during SVG export and would
 * silently break, so we fail early at the schema level.
 */
const CLIP_PATH_RE = /^(polygon|circle|ellipse|inset|path)\s*\(/;

export const CustomShape = z.object({
  clipPath: z.string().refine(
    (v) => CLIP_PATH_RE.test(v.trim()),
    {
      message:
        'clipPath must start with a valid CSS function (polygon, circle, ellipse, inset, or path). ' +
        'url() references are not supported — they are stripped during SVG export.',
    },
  ),
});
export type CustomShape = z.infer<typeof CustomShape>;

export const Shape = z.union([BuiltinShapeName, CustomShape]);
export type Shape = z.infer<typeof Shape>;

// --- Spec Components ---

export const ArgDef = z.object({
  name: z.string(),
  type: ArgType,
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
});
export type ArgDef = z.infer<typeof ArgDef>;

export const PortDef = z.object({
  name: z.string(),
  direction: PortDirection,
  protocol: z.array(z.string()),
  description: z.string().optional(),
});
export type PortDef = z.infer<typeof PortDef>;

export const ChildConstraint = z.object({
  nodedef: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type ChildConstraint = z.infer<typeof ChildConstraint>;

export const AiHints = z.object({
  context: z.string().optional(),
  reviewHints: z.array(z.string()).optional(),
});
export type AiHints = z.infer<typeof AiHints>;

export const Variant = z.object({
  name: z.string(),
  description: z.string().optional(),
  args: PropertyMap,
});
export type Variant = z.infer<typeof Variant>;

// --- Top-level ---

export const NodeDefMetadata = z.object({
  name: z.string(),
  namespace: z.string(),
  version: z.string(),
  displayName: z.string(),
  description: z.string(),
  icon: z.string(),
  tags: z.array(z.string()).optional(),
  shape: Shape,
});
export type NodeDefMetadata = z.infer<typeof NodeDefMetadata>;

export const NodeDefSpec = z.object({
  args: z.array(ArgDef).optional(),
  ports: z.array(PortDef).optional(),
  children: z.array(ChildConstraint).optional(),
  ai: AiHints.optional(),
});
export type NodeDefSpec = z.infer<typeof NodeDefSpec>;

export const NodeDef = z.object({
  kind: z.literal('NodeDef'),
  apiVersion: z.literal('v1'),
  metadata: NodeDefMetadata,
  spec: NodeDefSpec,
  variants: z.array(Variant).optional(),
});
export type NodeDef = z.infer<typeof NodeDef>;
