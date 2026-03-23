import { Document, isMap, isScalar, parseDocument, stringify } from 'yaml';
import {
  Canvas,
  type Canvas as CanvasFileType,
} from '../types';

export interface ParsedCanvas {
  data: CanvasFileType;
  doc: Document;
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class SerializeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerializeError';
  }
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc ? `${acc}.${String(segment)}` : String(segment);
  }, '');
}

export function parseCanvas(yamlContent: string): ParsedCanvas {
  const doc = parseDocument(yamlContent);

  if (doc.errors.length > 0) {
    throw new ParseError(
      `Invalid YAML: ${doc.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const raw = doc.toJSON();
  const result = Canvas.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${formatPath(i.path)}: ${i.message}`)
      .join(', ');
    throw new ParseError(`Schema validation failed: ${issues}`);
  }

  return { data: result.data, doc };
}

export function serializeCanvas(
  data: CanvasFileType,
  doc?: Document,
): string {
  const result = Canvas.safeParse(data);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${formatPath(i.path)}: ${i.message}`)
      .join(', ');
    throw new SerializeError(`Schema validation failed: ${issues}`);
  }

  if (doc) {
    // Field-level merge: update each top-level key individually
    // to preserve comments, key ordering, and formatting on unchanged sections
    const root = doc.contents;
    if (isMap(root)) {
      for (const key of Object.keys(result.data)) {
        const value = result.data[key as keyof typeof result.data];
        if (value !== undefined) {
          doc.set(key, doc.createNode(value));
        }
      }
      // Remove keys that are no longer in data
      // Collect first, then delete to avoid mutating during iteration
      const dataKeys = new Set(Object.keys(result.data));
      const keysToDelete = root.items
        .map((item) => (isScalar(item.key) ? item.key.value : item.key))
        .filter((k): k is string => typeof k === 'string' && !dataKeys.has(k));
      for (const k of keysToDelete) {
        doc.delete(k);
      }
    } else {
      doc.contents = doc.createNode(result.data);
    }
    return doc.toString();
  }

  return stringify(result.data, {
    indent: 2,
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'PLAIN',
  });
}
