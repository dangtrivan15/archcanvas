# I10: Core Data Model & YAML — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the foundation data layer — Zod schemas, YAML codec, platform file system, file resolver, and Zustand fileStore — so that downstream initiatives (I3, I4) have typed, persistent, reactive project data to build on.

**Architecture:** Five layers built bottom-up: Types (Zod schemas) → Platform (FileSystem interface + impls) → Storage (YAML codec + file resolver) → State (Zustand fileStore). Each layer depends only on the one below it. See [docs/specs/2026-03-11-i10-core-data-model-yaml-design.md](../specs/2026-03-11-i10-core-data-model-yaml-design.md) for the full design spec.

**Tech Stack:** Zod 4, yaml 2.8, Zustand 5, @tauri-apps/plugin-fs 2, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types/schema.ts` | All Zod schemas + inferred TypeScript types |
| `src/types/index.ts` | Re-exports |
| `src/storage/yamlCodec.ts` | Parse/serialize YAML with format preservation |
| `src/storage/fileResolver.ts` | Load project, follow refs, validate @root/ |
| `src/storage/index.ts` | Re-exports |
| `src/platform/fileSystem.ts` | FileSystem interface |
| `src/platform/inMemoryFileSystem.ts` | In-memory impl for testing |
| `src/platform/webFileSystem.ts` | Web File System Access API impl |
| `src/platform/tauriFileSystem.ts` | Tauri plugin-fs impl |
| `src/platform/index.ts` | Factory + re-exports |
| `src/store/fileStore.ts` | Zustand store (modify existing) |
| `test/unit/types/schema.test.ts` | Schema validation tests |
| `test/unit/storage/yamlCodec.test.ts` | Codec round-trip + format tests |
| `test/unit/platform/inMemoryFileSystem.test.ts` | InMemoryFileSystem tests |
| `test/unit/storage/fileResolver.test.ts` | Resolver tests with InMemoryFS |
| `test/unit/store/fileStore.test.ts` | Store state transition tests |
| `test/fixtures/yaml/*.yaml` | YAML fixture files for codec + resolver tests |

## Dependency Graph

```
Task 1: Zod Schemas               → blocks: [2, 4, 5]
Task 2: YAML Codec                → blockedBy: [1], blocks: [4]
Task 3: Platform FileSystem       → blocks: [4, 5]
Task 4: File Resolver             → blockedBy: [1, 2, 3], blocks: [5]
Task 5: fileStore                 → blockedBy: [4]
```

## Execution Strategy

- **Parallel group 1:** Task 1, Task 3 (independent)
- **Sequential:** Task 2 (after Task 1)
- **Sequential:** Task 4 (after Tasks 1, 2, 3)
- **Sequential:** Task 5 (after Task 4)

## Tasks

| # | Scope | Write Files | Source LOC | Config/Types LOC |
|---|-------|-------------|------------|------------------|
| 1 | Zod schemas | 2 | 0 | ~95 |
| 2 | YAML codec + fixtures | 3 | ~70 | 0 |
| 3 | Platform FileSystem | 5 | ~180 | ~10 |
| 4 | File resolver | 2 | ~110 | 0 |
| 5 | Zustand fileStore | 1 | ~65 | 0 |

---

## Task 1: Zod Schemas

**Scope:** Define all data model types as Zod schemas with inferred TypeScript types.

**Files:**
- Create: `src/types/schema.ts`
- Create: `src/types/index.ts`
- Create: `test/unit/types/schema.test.ts`

**Read set:**
- [docs/specs/2026-03-11-i10-core-data-model-yaml-design.md](../specs/2026-03-11-i10-core-data-model-yaml-design.md) — Layer 1 section
- [docs/archcanvas-v2-design.md](../archcanvas-v2-design.md#4-data-model--file-format) — YAML format examples

### Steps

- [ ] **Step 1: Write failing tests for all schemas**

```typescript
// test/unit/types/schema.test.ts
import { describe, it, expect } from 'vitest';
import {
  PropertyValue,
  PropertyMap,
  Note,
  Position,
  Entity,
  EdgeEndpoint,
  Edge,
  InlineNode,
  RefNode,
  Node,
  ProjectMetadata,
  CanvasFile,
  RootCanvasFile,
  SubsystemCanvasFile,
} from '@/types';

describe('PropertyValue', () => {
  it('accepts string', () => {
    expect(PropertyValue.parse('hello')).toBe('hello');
  });
  it('accepts number', () => {
    expect(PropertyValue.parse(42)).toBe(42);
  });
  it('accepts boolean', () => {
    expect(PropertyValue.parse(true)).toBe(true);
  });
  it('accepts string array', () => {
    expect(PropertyValue.parse(['a', 'b'])).toEqual(['a', 'b']);
  });
  it('rejects object', () => {
    expect(() => PropertyValue.parse({ key: 'val' })).toThrow();
  });
  it('rejects mixed array', () => {
    expect(() => PropertyValue.parse(['a', 1])).toThrow();
  });
});

describe('PropertyMap', () => {
  it('accepts valid map', () => {
    const input = { language: 'TypeScript', replicas: 2, enabled: true, tags: ['a'] };
    expect(PropertyMap.parse(input)).toEqual(input);
  });
  it('rejects nested objects', () => {
    expect(() => PropertyMap.parse({ nested: { a: 1 } })).toThrow();
  });
});

describe('Note', () => {
  it('accepts minimal note', () => {
    expect(Note.parse({ author: 'van', content: 'test' })).toEqual({
      author: 'van',
      content: 'test',
    });
  });
  it('accepts note with tags', () => {
    const note = { author: 'van', content: 'test', tags: ['reliability'] };
    expect(Note.parse(note)).toEqual(note);
  });
  it('rejects missing author', () => {
    expect(() => Note.parse({ content: 'test' })).toThrow();
  });
});

describe('Position', () => {
  it('accepts x, y only', () => {
    expect(Position.parse({ x: 100, y: 200 })).toEqual({ x: 100, y: 200 });
  });
  it('accepts full position', () => {
    const pos = { x: 100, y: 200, width: 300, height: 150 };
    expect(Position.parse(pos)).toEqual(pos);
  });
});

describe('Entity', () => {
  it('accepts minimal entity', () => {
    expect(Entity.parse({ name: 'Order' })).toEqual({ name: 'Order' });
  });
  it('accepts full entity', () => {
    const entity = {
      name: 'Order',
      description: 'Purchase order',
      codeRefs: ['src/domain/order/'],
    };
    expect(Entity.parse(entity)).toEqual(entity);
  });
});

describe('Edge', () => {
  it('accepts minimal edge', () => {
    const edge = {
      from: { node: 'svc-api' },
      to: { node: 'db-postgres' },
    };
    expect(Edge.parse(edge)).toEqual(edge);
  });
  it('accepts full edge', () => {
    const edge = {
      from: { node: 'svc-api', port: 'http-out' },
      to: { node: 'db-postgres', port: 'query-in' },
      protocol: 'SQL',
      label: 'persist orders',
      entities: ['Order'],
      notes: [{ author: 'van', content: 'needs optimization' }],
    };
    expect(Edge.parse(edge)).toEqual(edge);
  });
  it('accepts @root/ reference in endpoint', () => {
    const edge = {
      from: { node: 'handler', port: 'out' },
      to: { node: '@root/db-postgres', port: 'query-in' },
    };
    expect(Edge.parse(edge)).toEqual(edge);
  });
});

describe('Node union', () => {
  it('parses RefNode when ref is present', () => {
    const node = { id: 'svc-api', ref: 'svc-api' };
    const result = Node.parse(node);
    expect(result).toEqual(node);
    expect('ref' in result).toBe(true);
  });
  it('parses InlineNode when type is present', () => {
    const node = {
      id: 'db-postgres',
      type: 'data/database',
      displayName: 'PostgreSQL',
      args: { engine: 'PostgreSQL', version: '16' },
    };
    const result = Node.parse(node);
    expect(result).toEqual(node);
    expect('type' in result).toBe(true);
  });
  it('InlineNode accepts position', () => {
    const node = {
      id: 'svc-api',
      type: 'compute/service',
      position: { x: 0, y: 0, width: 200, height: 100 },
    };
    expect(Node.parse(node)).toEqual(node);
  });
  it('RefNode accepts position', () => {
    const node = { id: 'svc-api', ref: 'svc-api', position: { x: 50, y: 50 } };
    expect(Node.parse(node)).toEqual(node);
  });
});

describe('CanvasFile', () => {
  it('accepts empty canvas', () => {
    expect(CanvasFile.parse({})).toEqual({});
  });
  it('accepts root canvas with project metadata', () => {
    const canvas = {
      project: { name: 'Test', description: 'A test project' },
      nodes: [
        { id: 'svc-api', type: 'compute/service', displayName: 'API' },
      ],
      entities: [{ name: 'User' }],
      edges: [
        { from: { node: 'svc-api' }, to: { node: 'db' } },
      ],
    };
    expect(CanvasFile.parse(canvas)).toEqual(canvas);
  });
  it('accepts subsystem canvas with identity', () => {
    const canvas = {
      id: 'svc-api',
      type: 'compute/service',
      displayName: 'API Service',
      description: 'Main API',
      args: { language: 'TypeScript', framework: 'Express' },
      codeRefs: ['src/services/api/'],
      nodes: [
        { id: 'handler', type: 'compute/function', displayName: 'Handler' },
      ],
    };
    expect(CanvasFile.parse(canvas)).toEqual(canvas);
  });
});

describe('RootCanvasFile', () => {
  it('accepts canvas with project metadata', () => {
    const canvas = { project: { name: 'Test' } };
    expect(RootCanvasFile.parse(canvas)).toEqual(canvas);
  });
  it('rejects canvas without project metadata', () => {
    expect(() => RootCanvasFile.parse({})).toThrow(/project/i);
  });
});

describe('SubsystemCanvasFile', () => {
  it('accepts canvas with id and type', () => {
    const canvas = { id: 'svc-api', type: 'compute/service' };
    expect(SubsystemCanvasFile.parse(canvas)).toEqual(canvas);
  });
  it('rejects canvas without id', () => {
    expect(() => SubsystemCanvasFile.parse({ type: 'compute/service' })).toThrow();
  });
  it('rejects canvas without type', () => {
    expect(() => SubsystemCanvasFile.parse({ id: 'svc-api' })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/types/schema.test.ts`
Expected: FAIL — cannot resolve `@/types`

- [ ] **Step 3: Implement all schemas**

```typescript
// src/types/schema.ts
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
```

```typescript
// src/types/index.ts
export * from './schema';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/types/schema.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/schema.ts src/types/index.ts test/unit/types/schema.test.ts
git commit -m "feat(i10): add Zod schemas for data model"
```

---

## Task 2: YAML Codec

**Scope:** Parse and serialize YAML canvas files with format-preserving round-trips via the `yaml` Document API.

**Blocked by:** Task 1 (schemas)

**Files:**
- Create: `src/storage/yamlCodec.ts`
- Create: `src/storage/index.ts`
- Create: `test/unit/storage/yamlCodec.test.ts`
- Create: `test/fixtures/yaml/simple-root.yaml`
- Create: `test/fixtures/yaml/subsystem.yaml`
- Create: `test/fixtures/yaml/with-comments.yaml`

**Read set:**
- `src/types/schema.ts` — Zod schemas to validate against
- [docs/specs/2026-03-11-i10-core-data-model-yaml-design.md](../specs/2026-03-11-i10-core-data-model-yaml-design.md) — Layer 2 section

### Steps

- [ ] **Step 1: Create YAML fixture files**

```yaml
# test/fixtures/yaml/simple-root.yaml
project:
  name: Test Project
  description: A test project

nodes:
  - id: svc-api
    type: compute/service
    displayName: API Service
  - id: db-postgres
    type: data/database
    displayName: PostgreSQL
    args:
      engine: PostgreSQL
      version: "16"

entities:
  - name: User
    description: System user

edges:
  - from: { node: svc-api, port: http-out }
    to: { node: db-postgres, port: query-in }
    protocol: SQL
    label: persist users
    entities: [User]
```

```yaml
# test/fixtures/yaml/subsystem.yaml
id: svc-api
type: compute/service
displayName: API Service
description: Main API service
args:
  language: TypeScript
  framework: Express

nodes:
  - id: handler
    type: compute/function
    displayName: Request Handler
  - id: validator
    type: compute/function
    displayName: Input Validator

edges:
  - from: { node: handler, port: out }
    to: { node: validator, port: in }
    label: validate input
```

```yaml
# test/fixtures/yaml/with-comments.yaml
# Project header comment
project:
  name: Commented Project

# Infrastructure nodes
nodes:
  - id: svc-api
    type: compute/service
    displayName: API Service
```

- [ ] **Step 2: Write failing tests for codec**

```typescript
// test/unit/storage/yamlCodec.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseCanvasFile, serializeCanvasFile, ParseError, SerializeError } from '@/storage/yamlCodec';

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../../fixtures/yaml', name), 'utf-8');

describe('parseCanvasFile', () => {
  it('parses a valid root canvas', () => {
    const result = parseCanvasFile(fixture('simple-root.yaml'));
    expect(result.data.project?.name).toBe('Test Project');
    expect(result.data.nodes).toHaveLength(2);
    expect(result.data.entities).toHaveLength(1);
    expect(result.data.edges).toHaveLength(1);
    expect(result.doc).toBeDefined();
  });

  it('parses a valid subsystem canvas', () => {
    const result = parseCanvasFile(fixture('subsystem.yaml'));
    expect(result.data.id).toBe('svc-api');
    expect(result.data.type).toBe('compute/service');
    expect(result.data.nodes).toHaveLength(2);
  });

  it('returns a yaml.Document for format preservation', () => {
    const result = parseCanvasFile(fixture('with-comments.yaml'));
    expect(result.doc).toBeDefined();
    // Document should preserve the comment
    const output = result.doc.toString();
    expect(output).toContain('# Project header comment');
  });

  it('throws ParseError on invalid YAML syntax', () => {
    expect(() => parseCanvasFile('{')).toThrow(ParseError);
  });

  it('throws ParseError on schema validation failure', () => {
    const invalidYaml = 'project:\n  name: 123'; // name must be string
    expect(() => parseCanvasFile(invalidYaml)).toThrow(ParseError);
  });
});

describe('serializeCanvasFile', () => {
  it('serializes a CanvasFile to valid YAML', () => {
    const data = {
      project: { name: 'Test' },
      nodes: [{ id: 'svc-api', type: 'compute/service' }],
    };
    const yaml = serializeCanvasFile(data);
    expect(yaml).toContain('name: Test');
    expect(yaml).toContain('id: svc-api');
  });

  it('throws SerializeError on invalid data', () => {
    const invalid = { project: { name: 123 } } as any;
    expect(() => serializeCanvasFile(invalid)).toThrow(SerializeError);
  });

  it('preserves formatting when doc is provided', () => {
    const original = fixture('with-comments.yaml');
    const parsed = parseCanvasFile(original);
    const reserialized = serializeCanvasFile(parsed.data, parsed.doc);
    expect(reserialized).toContain('# Project header comment');
  });

  it('round-trips data without loss', () => {
    const original = fixture('simple-root.yaml');
    const parsed = parseCanvasFile(original);
    const serialized = serializeCanvasFile(parsed.data, parsed.doc);
    const reparsed = parseCanvasFile(serialized);
    expect(reparsed.data).toEqual(parsed.data);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/unit/storage/yamlCodec.test.ts`
Expected: FAIL — cannot resolve `@/storage/yamlCodec`

- [ ] **Step 4: Implement YAML codec**

```typescript
// src/storage/yamlCodec.ts
import { Document, parseDocument, stringify } from 'yaml';
import { CanvasFile } from '../types';

export interface ParsedCanvas {
  data: CanvasFile;
  doc: Document;
}

export function parseCanvasFile(yamlContent: string): ParsedCanvas {
  const doc = parseDocument(yamlContent);

  if (doc.errors.length > 0) {
    throw new ParseError(
      `Invalid YAML: ${doc.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const raw = doc.toJSON();
  const result = CanvasFile.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new ParseError(`Schema validation failed: ${issues}`);
  }

  return { data: result.data, doc };
}

export function serializeCanvasFile(
  data: CanvasFile,
  doc?: Document,
): string {
  const result = CanvasFile.safeParse(data);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new SerializeError(`Schema validation failed: ${issues}`);
  }

  if (doc) {
    // Field-level merge: update each top-level key individually
    // to preserve comments, key ordering, and formatting on unchanged sections
    const root = doc.contents;
    if (root && 'items' in root) {
      // Clear existing keys and re-set from data
      // This preserves doc-level comments (commentBefore, comment)
      // while updating the content tree
      for (const key of Object.keys(result.data)) {
        const value = result.data[key as keyof typeof result.data];
        if (value !== undefined) {
          doc.set(key, doc.createNode(value));
        }
      }
      // Remove keys that are no longer in data
      const dataKeys = new Set(Object.keys(result.data));
      for (const item of (root as any).items) {
        const key = item.key?.value ?? item.key;
        if (typeof key === 'string' && !dataKeys.has(key)) {
          doc.delete(key);
        }
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
```

```typescript
// src/storage/index.ts
export { parseCanvasFile, serializeCanvasFile, ParseError, SerializeError } from './yamlCodec';
export type { ParsedCanvas } from './yamlCodec';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/storage/yamlCodec.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/storage/ test/unit/storage/yamlCodec.test.ts test/fixtures/yaml/
git commit -m "feat(i10): add YAML codec with format-preserving round-trips"
```

---

## Task 3: Platform FileSystem

**Scope:** FileSystem interface, InMemoryFileSystem (for tests), WebFileSystem, and TauriFileSystem.

**No dependencies** — can run in parallel with Task 1.

**Files:**
- Create: `src/platform/fileSystem.ts`
- Create: `src/platform/inMemoryFileSystem.ts`
- Create: `src/platform/webFileSystem.ts`
- Create: `src/platform/tauriFileSystem.ts`
- Create: `src/platform/index.ts`
- Create: `test/unit/platform/inMemoryFileSystem.test.ts`

**Read set:**
- [docs/specs/2026-03-11-i10-core-data-model-yaml-design.md](../specs/2026-03-11-i10-core-data-model-yaml-design.md) — Layer 3 section

**Note:** WebFileSystem and TauriFileSystem cannot be unit-tested in Vitest (they require browser/Tauri runtime). Only InMemoryFileSystem is unit-tested. Web/Tauri impls are verified through manual testing or e2e.

### Steps

- [ ] **Step 1: Write failing tests for InMemoryFileSystem**

```typescript
// test/unit/platform/inMemoryFileSystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';

describe('InMemoryFileSystem', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  describe('readFile / writeFile', () => {
    it('writes and reads a file', async () => {
      await fs.writeFile('test.txt', 'hello');
      expect(await fs.readFile('test.txt')).toBe('hello');
    });

    it('overwrites existing file', async () => {
      await fs.writeFile('test.txt', 'first');
      await fs.writeFile('test.txt', 'second');
      expect(await fs.readFile('test.txt')).toBe('second');
    });

    it('throws on reading non-existent file', async () => {
      await expect(fs.readFile('missing.txt')).rejects.toThrow(/not found/i);
    });

    it('handles nested paths', async () => {
      await fs.writeFile('.archcanvas/main.yaml', 'content');
      expect(await fs.readFile('.archcanvas/main.yaml')).toBe('content');
    });
  });

  describe('listFiles', () => {
    it('lists files in a directory', async () => {
      await fs.writeFile('.archcanvas/main.yaml', 'a');
      await fs.writeFile('.archcanvas/svc-api.yaml', 'b');
      await fs.writeFile('.archcanvas/nodedefs/custom.yaml', 'c');
      const files = await fs.listFiles('.archcanvas');
      expect(files).toContain('main.yaml');
      expect(files).toContain('svc-api.yaml');
      expect(files).not.toContain('custom.yaml'); // in subdirectory
    });

    it('returns empty array for empty directory', async () => {
      expect(await fs.listFiles('.archcanvas')).toEqual([]);
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      await fs.writeFile('test.txt', 'hello');
      expect(await fs.exists('test.txt')).toBe(true);
    });

    it('returns false for non-existent file', async () => {
      expect(await fs.exists('missing.txt')).toBe(false);
    });

    it('returns true for directory containing files', async () => {
      await fs.writeFile('.archcanvas/main.yaml', 'content');
      expect(await fs.exists('.archcanvas')).toBe(true);
    });
  });

  describe('mkdir', () => {
    it('is a no-op (directories are implicit)', async () => {
      await expect(fs.mkdir('.archcanvas')).resolves.toBeUndefined();
    });
  });

  describe('seed helper', () => {
    it('populates multiple files at once', async () => {
      fs.seed({
        '.archcanvas/main.yaml': 'root content',
        '.archcanvas/svc-api.yaml': 'api content',
      });
      expect(await fs.readFile('.archcanvas/main.yaml')).toBe('root content');
      expect(await fs.readFile('.archcanvas/svc-api.yaml')).toBe('api content');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/platform/inMemoryFileSystem.test.ts`
Expected: FAIL — cannot resolve `@/platform/inMemoryFileSystem`

- [ ] **Step 3: Implement FileSystem interface**

```typescript
// src/platform/fileSystem.ts
export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}
```

- [ ] **Step 4: Implement InMemoryFileSystem**

```typescript
// src/platform/inMemoryFileSystem.ts
import type { FileSystem } from './fileSystem';

export class InMemoryFileSystem implements FileSystem {
  private files = new Map<string, string>();

  async readFile(path: string): Promise<string> {
    const content = this.files.get(this.normalize(path));
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(this.normalize(path), content);
  }

  async listFiles(path: string): Promise<string[]> {
    const dir = this.normalize(path);
    const prefix = dir === '' ? '' : dir + '/';
    const results: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        if (!rest.includes('/')) {
          results.push(rest);
        }
      }
    }
    return results;
  }

  async exists(path: string): Promise<boolean> {
    const norm = this.normalize(path);
    if (this.files.has(norm)) return true;
    const prefix = norm + '/';
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  async mkdir(): Promise<void> {
    // No-op — directories are implicit in the file map
  }

  /** Populate multiple files at once (test helper) */
  seed(files: Record<string, string>): void {
    for (const [path, content] of Object.entries(files)) {
      this.files.set(this.normalize(path), content);
    }
  }

  /** Return all files as a plain object (test helper) */
  getAll(): Record<string, string> {
    return Object.fromEntries(this.files);
  }

  private normalize(path: string): string {
    return path.replace(/^\/+/, '').replace(/\/+$/, '');
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/platform/inMemoryFileSystem.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Implement WebFileSystem**

```typescript
// src/platform/webFileSystem.ts
import type { FileSystem } from './fileSystem';

export class WebFileSystem implements FileSystem {
  constructor(private rootHandle: FileSystemDirectoryHandle) {}

  async readFile(path: string): Promise<string> {
    const { dir, fileName } = await this.resolve(path);
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { dir, fileName } = await this.resolve(path, true);
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async listFiles(path: string): Promise<string[]> {
    const dir = await this.resolveDir(path);
    const entries: string[] = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file') {
        entries.push(name);
      }
    }
    return entries;
  }

  async exists(path: string): Promise<boolean> {
    try {
      const { dir, fileName } = await this.resolve(path);
      try {
        await dir.getFileHandle(fileName);
        return true;
      } catch {
        try {
          await dir.getDirectoryHandle(fileName);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await this.resolveDir(path, true);
  }

  private async resolve(
    path: string,
    createDirs = false,
  ): Promise<{ dir: FileSystemDirectoryHandle; fileName: string }> {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: createDirs });
    }
    return { dir, fileName };
  }

  private async resolveDir(
    path: string,
    create = false,
  ): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/').filter(Boolean);
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }
}
```

- [ ] **Step 7: Install Tauri fs plugin and implement TauriFileSystem**

Run: `cd src-tauri && cargo add tauri-plugin-fs`

```typescript
// src/platform/tauriFileSystem.ts
import type { FileSystem } from './fileSystem';
import {
  readTextFile,
  writeTextFile,
  exists as tauriExists,
  mkdir as tauriMkdir,
  readDir,
} from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export class TauriFileSystem implements FileSystem {
  constructor(private rootPath: string) {}

  private async resolve(path: string): Promise<string> {
    return join(this.rootPath, path);
  }

  async readFile(path: string): Promise<string> {
    return readTextFile(await this.resolve(path));
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeTextFile(await this.resolve(path), content);
  }

  async listFiles(path: string): Promise<string[]> {
    const entries = await readDir(await this.resolve(path));
    return entries
      .filter((e) => e.isFile)
      .map((e) => e.name)
      .filter((name): name is string => name != null);
  }

  async exists(path: string): Promise<boolean> {
    return tauriExists(await this.resolve(path));
  }

  async mkdir(path: string): Promise<void> {
    await tauriMkdir(await this.resolve(path), { recursive: true });
  }
}
```

- [ ] **Step 8: Create platform index with re-exports**

```typescript
// src/platform/index.ts
export type { FileSystem } from './fileSystem';
export { InMemoryFileSystem } from './inMemoryFileSystem';
export { WebFileSystem } from './webFileSystem';
export { TauriFileSystem } from './tauriFileSystem';

import type { FileSystem } from './fileSystem';

/**
 * Detect platform and return the appropriate FileSystem implementation.
 * - Tauri: uses @tauri-apps/plugin-fs with the given root path
 * - Web: uses File System Access API with the given directory handle
 */
export async function createFileSystem(
  root: FileSystemDirectoryHandle | string,
): Promise<FileSystem> {
  if (typeof root === 'string') {
    // Tauri — root is a filesystem path
    const { TauriFileSystem } = await import('./tauriFileSystem');
    return new TauriFileSystem(root);
  }
  // Web — root is a FileSystemDirectoryHandle
  const { WebFileSystem } = await import('./webFileSystem');
  return new WebFileSystem(root);
}
```

- [ ] **Step 9: Commit**

```bash
git add src/platform/ test/unit/platform/
git commit -m "feat(i10): add FileSystem interface with Web, Tauri, and InMemory impls"
```

---

## Task 4: File Resolver

**Scope:** Load a full project from `.archcanvas/`, follow `ref:` pointers, validate `@root/` references, save canvases.

**Blocked by:** Tasks 1, 2, 3

**Files:**
- Create: `src/storage/fileResolver.ts`
- Modify: `src/storage/index.ts` (add re-exports)
- Create: `test/unit/storage/fileResolver.test.ts`

**Read set:**
- `src/types/schema.ts` — data types
- `src/storage/yamlCodec.ts` — parse/serialize functions
- `src/platform/fileSystem.ts` — FileSystem interface
- `src/platform/inMemoryFileSystem.ts` — test adapter
- [docs/specs/2026-03-11-i10-core-data-model-yaml-design.md](../specs/2026-03-11-i10-core-data-model-yaml-design.md) — Layer 4 section

### Steps

- [ ] **Step 1: Write failing tests for file resolver**

```typescript
// test/unit/storage/fileResolver.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { loadProject, saveCanvas, ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import { serializeCanvasFile } from '@/storage/yamlCodec';

function yamlOf(data: Record<string, unknown>): string {
  return serializeCanvasFile(data as any);
}

describe('loadProject', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  it('loads a simple project with no refs', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'svc-api', type: 'compute/service' }],
      }),
    });

    const project = await loadProject(fs);
    expect(project.root.data.project?.name).toBe('Test');
    expect(project.root.data.nodes).toHaveLength(1);
    expect(project.canvases.has(ROOT_CANVAS_KEY)).toBe(true);
    expect(project.errors).toHaveLength(0);
  });

  it('resolves ref nodes to subsystem files', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'svc-api', ref: 'svc-api' },
          { id: 'db', type: 'data/database' },
        ],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        id: 'svc-api',
        type: 'compute/service',
        displayName: 'API Service',
        nodes: [{ id: 'handler', type: 'compute/function' }],
      }),
    });

    const project = await loadProject(fs);
    expect(project.canvases.has('svc-api')).toBe(true);
    expect(project.canvases.get('svc-api')?.data.displayName).toBe('API Service');
    expect(project.errors).toHaveLength(0);
  });

  it('resolves nested refs recursively', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'svc-api', ref: 'svc-api' }],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        id: 'svc-api',
        type: 'compute/service',
        nodes: [{ id: 'internal', ref: 'internal' }],
      }),
      '.archcanvas/internal.yaml': yamlOf({
        id: 'internal',
        type: 'compute/function',
        nodes: [{ id: 'leaf', type: 'compute/function' }],
      }),
    });

    const project = await loadProject(fs);
    expect(project.canvases.has('svc-api')).toBe(true);
    expect(project.canvases.has('internal')).toBe(true);
  });

  it('collects error for missing ref file', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'missing', ref: 'missing-service' }],
      }),
    });

    const project = await loadProject(fs);
    expect(project.errors).toHaveLength(1);
    expect(project.errors[0].message).toContain('missing-service');
  });

  it('detects circular refs and collects error', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'a', ref: 'a' }],
      }),
      '.archcanvas/a.yaml': yamlOf({
        id: 'a',
        type: 'compute/service',
        nodes: [{ id: 'b', ref: 'b' }],
      }),
      '.archcanvas/b.yaml': yamlOf({
        id: 'b',
        type: 'compute/service',
        nodes: [{ id: 'a-again', ref: 'a' }],
      }),
    });

    const project = await loadProject(fs);
    const circularError = project.errors.find((e) =>
      e.message.toLowerCase().includes('circular'),
    );
    expect(circularError).toBeDefined();
  });

  it('handles diamond dependencies without false circular error', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'a', ref: 'a' },
          { id: 'b', ref: 'b' },
        ],
      }),
      '.archcanvas/a.yaml': yamlOf({
        id: 'a',
        type: 'compute/service',
        nodes: [{ id: 'shared', ref: 'shared' }],
      }),
      '.archcanvas/b.yaml': yamlOf({
        id: 'b',
        type: 'compute/service',
        nodes: [{ id: 'shared-again', ref: 'shared' }],
      }),
      '.archcanvas/shared.yaml': yamlOf({
        id: 'shared',
        type: 'data/database',
      }),
    });

    const project = await loadProject(fs);
    // shared is loaded once, no circular error
    expect(project.canvases.has('shared')).toBe(true);
    const circularErrors = project.errors.filter((e) =>
      e.message.toLowerCase().includes('circular'),
    );
    expect(circularErrors).toHaveLength(0);
  });

  it('validates @root/ references — valid', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'svc-api', ref: 'svc-api' },
          { id: 'db', type: 'data/database' },
        ],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        id: 'svc-api',
        type: 'compute/service',
        nodes: [{ id: 'handler', type: 'compute/function' }],
        edges: [
          {
            from: { node: 'handler', port: 'db-out' },
            to: { node: '@root/db', port: 'query-in' },
          },
        ],
      }),
    });

    const project = await loadProject(fs);
    const rootRefErrors = project.errors.filter((e) =>
      e.message.includes('@root/'),
    );
    expect(rootRefErrors).toHaveLength(0);
  });

  it('validates @root/ references — invalid', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'svc-api', ref: 'svc-api' }],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        id: 'svc-api',
        type: 'compute/service',
        edges: [
          {
            from: { node: 'handler' },
            to: { node: '@root/nonexistent' },
          },
        ],
      }),
    });

    const project = await loadProject(fs);
    const rootRefErrors = project.errors.filter((e) =>
      e.message.includes('@root/'),
    );
    expect(rootRefErrors).toHaveLength(1);
    expect(rootRefErrors[0].message).toContain('nonexistent');
  });
});

describe('saveCanvas', () => {
  it('writes canvas back to the file system', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
      }),
    });

    const project = await loadProject(fs);
    // Mutate data
    project.root.data.project!.name = 'Updated';

    await saveCanvas(fs, project.root);

    const written = await fs.readFile('.archcanvas/main.yaml');
    expect(written).toContain('Updated');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/storage/fileResolver.test.ts`
Expected: FAIL — cannot resolve `@/storage/fileResolver`

- [ ] **Step 3: Implement file resolver**

```typescript
// src/storage/fileResolver.ts
import type { Document } from 'yaml';
import type { FileSystem } from '../platform/fileSystem';
import type { CanvasFile } from '../types';
import { parseCanvasFile, serializeCanvasFile } from './yamlCodec';

export interface LoadedCanvas {
  filePath: string;
  data: CanvasFile;
  doc: Document;
}

export interface ResolvedProject {
  root: LoadedCanvas;
  canvases: Map<string, LoadedCanvas>;
  errors: ResolutionError[];
}

export interface ResolutionError {
  file: string;
  message: string;
}

export const ROOT_CANVAS_KEY = '__root__';

export async function loadProject(
  fs: FileSystem,
): Promise<ResolvedProject> {
  const errors: ResolutionError[] = [];
  const canvases = new Map<string, LoadedCanvas>();
  const loaded = new Set<string>();    // already loaded (skip re-loading)
  const ancestors = new Set<string>(); // current DFS path (detect cycles)

  const mainPath = '.archcanvas/main.yaml';
  const mainContent = await fs.readFile(mainPath);
  const mainParsed = parseCanvasFile(mainContent);

  const root: LoadedCanvas = {
    filePath: mainPath,
    data: mainParsed.data,
    doc: mainParsed.doc,
  };
  canvases.set(ROOT_CANVAS_KEY, root);

  await resolveRefs(fs, root, canvases, errors, loaded, ancestors);
  validateRootRefs(root, canvases, errors);

  return { root, canvases, errors };
}

async function resolveRefs(
  fs: FileSystem,
  canvas: LoadedCanvas,
  canvases: Map<string, LoadedCanvas>,
  errors: ResolutionError[],
  loaded: Set<string>,
  ancestors: Set<string>,
): Promise<void> {
  const nodes = canvas.data.nodes ?? [];

  for (const node of nodes) {
    if (!('ref' in node) || !node.ref) continue;

    const ref = node.ref;

    // True cycle: this ref is an ancestor in the current DFS path
    if (ancestors.has(ref)) {
      errors.push({
        file: canvas.filePath,
        message: `Circular reference detected: ${ref}`,
      });
      continue;
    }

    // Diamond: already loaded via a different path — skip, no error
    if (loaded.has(ref)) continue;

    loaded.add(ref);
    ancestors.add(ref);
    const filePath = `.archcanvas/${ref}.yaml`;

    try {
      const content = await fs.readFile(filePath);
      const parsed = parseCanvasFile(content);
      const loadedCanvas: LoadedCanvas = {
        filePath,
        data: parsed.data,
        doc: parsed.doc,
      };
      canvases.set(ref, loadedCanvas);

      await resolveRefs(fs, loadedCanvas, canvases, errors, loaded, ancestors);
    } catch (err) {
      errors.push({
        file: canvas.filePath,
        message: `Failed to load ref '${ref}': ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    ancestors.delete(ref); // backtrack
  }
}

function validateRootRefs(
  root: LoadedCanvas,
  canvases: Map<string, LoadedCanvas>,
  errors: ResolutionError[],
): void {
  const rootNodeIds = new Set(
    (root.data.nodes ?? []).map((n) => n.id),
  );

  for (const [id, canvas] of canvases) {
    if (id === ROOT_CANVAS_KEY) continue;

    for (const edge of canvas.data.edges ?? []) {
      for (const endpoint of [edge.from, edge.to]) {
        if (endpoint.node.startsWith('@root/')) {
          const refId = endpoint.node.slice('@root/'.length);
          if (!rootNodeIds.has(refId)) {
            errors.push({
              file: canvas.filePath,
              message: `@root/ reference '${refId}' not found in root canvas`,
            });
          }
        }
      }
    }
  }
}

export async function saveCanvas(
  fs: FileSystem,
  canvas: LoadedCanvas,
): Promise<void> {
  const yamlString = serializeCanvasFile(canvas.data, canvas.doc);
  await fs.writeFile(canvas.filePath, yamlString);
}
```

- [ ] **Step 4: Update storage index — replace with complete final content**

```typescript
// src/storage/index.ts (complete file — replaces Task 2 version)
export { parseCanvasFile, serializeCanvasFile, ParseError, SerializeError } from './yamlCodec';
export type { ParsedCanvas } from './yamlCodec';
export { loadProject, saveCanvas, ROOT_CANVAS_KEY } from './fileResolver';
export type { LoadedCanvas, ResolvedProject, ResolutionError } from './fileResolver';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/storage/fileResolver.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/storage/fileResolver.ts src/storage/index.ts test/unit/storage/fileResolver.test.ts
git commit -m "feat(i10): add file resolver with ref following and @root/ validation"
```

---

## Task 5: Zustand fileStore

**Scope:** Reactive Zustand store that exposes loaded project state, dirty tracking, and save actions.

**Blocked by:** Task 4

**Files:**
- Modify: `src/store/fileStore.ts` (new file — existing `uiStore.ts` is separate)
- Create: `test/unit/store/fileStore.test.ts`

**Read set:**
- `src/storage/fileResolver.ts` — functions delegated to
- `src/platform/fileSystem.ts` — FileSystem interface (passed as argument)
- `src/platform/inMemoryFileSystem.ts` — test adapter
- `src/store/uiStore.ts` — existing store for pattern reference

### Steps

- [ ] **Step 1: Write failing tests for fileStore**

```typescript
// test/unit/store/fileStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvasFile } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

function yamlOf(data: Record<string, unknown>): string {
  return serializeCanvasFile(data as any);
}

describe('fileStore', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    // Reset store state between tests
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
    });

    fs = new InMemoryFileSystem();
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'svc-api', ref: 'svc-api' },
          { id: 'db', type: 'data/database' },
        ],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        id: 'svc-api',
        type: 'compute/service',
        displayName: 'API Service',
      }),
    });
  });

  describe('openProject', () => {
    it('transitions to loading then loaded', async () => {
      const promise = useFileStore.getState().openProject(fs);
      expect(useFileStore.getState().status).toBe('loading');

      await promise;
      expect(useFileStore.getState().status).toBe('loaded');
      expect(useFileStore.getState().project).not.toBeNull();
      expect(useFileStore.getState().error).toBeNull();
    });

    it('sets project data correctly', async () => {
      await useFileStore.getState().openProject(fs);
      const { project } = useFileStore.getState();
      expect(project?.root.data.project?.name).toBe('Test');
      expect(project?.canvases.has('svc-api')).toBe(true);
    });

    it('clears dirty canvases on load', async () => {
      useFileStore.setState({ dirtyCanvases: new Set(['old']) });
      await useFileStore.getState().openProject(fs);
      expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
    });

    it('sets error status on failure', async () => {
      const emptyFs = new InMemoryFileSystem();
      await useFileStore.getState().openProject(emptyFs);
      expect(useFileStore.getState().status).toBe('error');
      expect(useFileStore.getState().error).toBeTruthy();
    });
  });

  describe('markDirty', () => {
    it('adds canvas ID to dirty set', () => {
      useFileStore.getState().markDirty('svc-api');
      expect(useFileStore.getState().dirtyCanvases.has('svc-api')).toBe(true);
    });

    it('does not duplicate entries', () => {
      useFileStore.getState().markDirty('svc-api');
      useFileStore.getState().markDirty('svc-api');
      expect(useFileStore.getState().dirtyCanvases.size).toBe(1);
    });
  });

  describe('saveCanvas', () => {
    it('writes to file system and clears dirty flag', async () => {
      await useFileStore.getState().openProject(fs);
      useFileStore.getState().markDirty('svc-api');

      await useFileStore.getState().saveCanvas(fs, 'svc-api');

      expect(useFileStore.getState().dirtyCanvases.has('svc-api')).toBe(false);
      const written = await fs.readFile('.archcanvas/svc-api.yaml');
      expect(written).toContain('API Service');
    });
  });

  describe('saveAll', () => {
    it('saves all dirty canvases', async () => {
      await useFileStore.getState().openProject(fs);
      useFileStore.getState().markDirty(ROOT_CANVAS_KEY);
      useFileStore.getState().markDirty('svc-api');

      await useFileStore.getState().saveAll(fs);

      expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
    });
  });

  describe('getCanvas / getRootCanvas', () => {
    it('getCanvas returns canvas by ID', async () => {
      await useFileStore.getState().openProject(fs);
      const canvas = useFileStore.getState().getCanvas('svc-api');
      expect(canvas?.data.displayName).toBe('API Service');
    });

    it('getCanvas returns undefined for unknown ID', async () => {
      await useFileStore.getState().openProject(fs);
      expect(useFileStore.getState().getCanvas('nonexistent')).toBeUndefined();
    });

    it('getRootCanvas returns the root', async () => {
      await useFileStore.getState().openProject(fs);
      const root = useFileStore.getState().getRootCanvas();
      expect(root?.data.project?.name).toBe('Test');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/store/fileStore.test.ts`
Expected: FAIL — cannot resolve `@/store/fileStore`

- [ ] **Step 3: Implement fileStore**

```typescript
// src/store/fileStore.ts
import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import {
  loadProject,
  saveCanvas as saveCanvasToFile,
  ROOT_CANVAS_KEY,
  type LoadedCanvas,
  type ResolvedProject,
} from '../storage/fileResolver';

interface FileStoreState {
  project: ResolvedProject | null;
  dirtyCanvases: Set<string>;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;

  openProject: (fs: FileSystem) => Promise<void>;
  saveCanvas: (fs: FileSystem, canvasId: string) => Promise<void>;
  saveAll: (fs: FileSystem) => Promise<void>;
  markDirty: (canvasId: string) => void;
  getCanvas: (canvasId: string) => LoadedCanvas | undefined;
  getRootCanvas: () => LoadedCanvas | undefined;
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  project: null,
  dirtyCanvases: new Set(),
  status: 'idle',
  error: null,

  openProject: async (fs) => {
    set({ status: 'loading', error: null });
    try {
      const project = await loadProject(fs);
      set({ project, status: 'loaded', dirtyCanvases: new Set() });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  saveCanvas: async (fs, canvasId) => {
    const { project, dirtyCanvases } = get();
    const canvas = project?.canvases.get(canvasId);
    if (!canvas) return;

    await saveCanvasToFile(fs, canvas);
    const next = new Set(dirtyCanvases);
    next.delete(canvasId);
    set({ dirtyCanvases: next });
  },

  saveAll: async (fs) => {
    const { dirtyCanvases } = get();
    for (const canvasId of dirtyCanvases) {
      await get().saveCanvas(fs, canvasId);
    }
  },

  markDirty: (canvasId) => {
    const next = new Set(get().dirtyCanvases);
    next.add(canvasId);
    set({ dirtyCanvases: next });
  },

  getCanvas: (canvasId) => {
    return get().project?.canvases.get(canvasId);
  },

  getRootCanvas: () => {
    return get().project?.root;
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/store/fileStore.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run all I10 tests together**

Run: `npx vitest run test/unit/types/ test/unit/storage/ test/unit/platform/ test/unit/store/`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/store/fileStore.ts test/unit/store/fileStore.test.ts
git commit -m "feat(i10): add Zustand fileStore with project loading and dirty tracking"
```
