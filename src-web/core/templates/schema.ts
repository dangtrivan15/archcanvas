import { z } from 'zod/v4';
import { Canvas } from '../../types';

// ---------------------------------------------------------------------------
// Template metadata
// ---------------------------------------------------------------------------

export const TemplateCategory = z.enum([
  'backend',
  'frontend',
  'fullstack',
  'data',
  'devops',
]);
export type TemplateCategory = z.infer<typeof TemplateCategory>;

export const ArchTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: TemplateCategory,
  icon: z.string(),
  tags: z.array(z.string()),
  canvas: Canvas,
});
export type ArchTemplate = z.infer<typeof ArchTemplateSchema>;
