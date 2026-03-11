import { z } from 'zod/v4';

// --- Primitives ---

export const PropertyValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);
export type PropertyValue = z.infer<typeof PropertyValue>;

export const PropertyMap = z.record(z.string(), PropertyValue);
export type PropertyMap = z.infer<typeof PropertyMap>;

// --- Annotations ---

export const Note = z.object({
  author: z.string(),
  content: z.string(),
  tags: z.array(z.string()).optional(),
});
export type Note = z.infer<typeof Note>;

// --- Spatial ---

export const Position = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
});
export type Position = z.infer<typeof Position>;

// --- Data Pillar ---

export const Entity = z.object({
  name: z.string(),
  description: z.string().optional(),
  codeRefs: z.array(z.string()).optional(),
});
export type Entity = z.infer<typeof Entity>;

// --- Connections Pillar ---

export const EdgeEndpoint = z.object({
  node: z.string(),
  port: z.string().optional(),
});
export type EdgeEndpoint = z.infer<typeof EdgeEndpoint>;

export const Edge = z.object({
  from: EdgeEndpoint,
  to: EdgeEndpoint,
  protocol: z.string().optional(),
  label: z.string().optional(),
  entities: z.array(z.string()).optional(),
  notes: z.array(Note).optional(),
});
export type Edge = z.infer<typeof Edge>;

// --- Software Pillar ---

export const InlineNode = z.object({
  id: z.string(),
  type: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  args: PropertyMap.optional(),
  position: Position.optional(),
  codeRefs: z.array(z.string()).optional(),
  notes: z.array(Note).optional(),
});
export type InlineNode = z.infer<typeof InlineNode>;

export const RefNode = z.object({
  id: z.string(),
  ref: z.string(),
  position: Position.optional(),
});
export type RefNode = z.infer<typeof RefNode>;

export const Node = z.union([RefNode, InlineNode]);
export type Node = z.infer<typeof Node>;

// --- Project ---

export const ProjectMetadata = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
});
export type ProjectMetadata = z.infer<typeof ProjectMetadata>;

// --- Canvas File ---

export const CanvasFile = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  args: PropertyMap.optional(),
  codeRefs: z.array(z.string()).optional(),
  notes: z.array(Note).optional(),
  project: ProjectMetadata.optional(),
  nodes: z.array(Node).optional(),
  entities: z.array(Entity).optional(),
  edges: z.array(Edge).optional(),
});
export type CanvasFile = z.infer<typeof CanvasFile>;

// --- Refinements ---

export const RootCanvasFile = CanvasFile.refine(
  (f) => f.project != null,
  { message: 'Root canvas must have project metadata' },
);

export const SubsystemCanvasFile = CanvasFile.refine(
  (f) => f.id != null && f.type != null,
  { message: 'Subsystem canvas must have id and type' },
);
