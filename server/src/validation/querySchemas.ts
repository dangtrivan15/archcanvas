import { z } from 'zod/v4';

export const SearchQuerySchema = z.object({
  q: z.string().optional(),
  namespace: z.string().optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  sort: z
    .enum(['relevance', 'recent', 'popular', 'name'])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const FetchQuerySchema = z.object({
  version: z.string().optional(),
  format: z.enum(['json', 'yaml']).optional(),
});

export const GitHubAuthSchema = z.object({
  code: z.string(),
});

export const CreateTokenSchema = z.object({
  name: z.string().min(1).max(100),
});

export function validateRequest<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { data: T } | { error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { data: result.data };
  }
  const issues = result.error.issues
    .map(
      (i) =>
        `${i.path.join('.')}: ${i.message}`,
    )
    .join('; ');
  return { error: `Validation failed: ${issues}` };
}
