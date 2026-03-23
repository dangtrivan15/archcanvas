import { parse } from 'yaml';
import { NodeDef } from '@/types';

export type ParseResult =
  | { nodeDef: NodeDef }
  | { error: string };

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc ? `${acc}.${String(segment)}` : String(segment);
  }, '');
}

export function parseNodeDef(yamlContent: string): ParseResult {
  let raw: unknown;
  try {
    raw = parse(yamlContent);
  } catch (e) {
    return { error: `Invalid YAML: ${e instanceof Error ? e.message : String(e)}` };
  }

  const result = NodeDef.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${formatPath(i.path)}: ${i.message}`)
      .join('; ');
    return { error: `Schema validation failed: ${issues}` };
  }

  return { nodeDef: result.data };
}
