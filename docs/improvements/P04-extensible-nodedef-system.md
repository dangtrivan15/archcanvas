# P04: Extensible NodeDef Plugin System

**Parallel safety**: FULLY INDEPENDENT. Touches only `src/core/registry/` files.
No overlap with any other proposal.

---

## Problem

### Hardcoded Registry

`src/core/registry/loader.ts` loads node definitions at build time via Vite-specific imports:

```typescript
// loader.ts — 91 hardcoded YAML ?raw imports
import computeServiceYaml from './builtins/compute/service.yaml?raw';
import computeFunctionYaml from './builtins/compute/function.yaml?raw';
// ... 89 more ...

const YAML_SOURCES = [
  computeServiceYaml,
  computeFunctionYaml,
  // ...
];
```

### Read-Only After Init

`src/core/registry/registryCore.ts` has an `initialized` flag that prevents adding new
node types after startup:

```typescript
// registryCore.ts
private initialized = false;

init(defs: NodeDef[]) {
  if (this.initialized) return;
  // ... load defs
  this.initialized = true;
}
```

### No Runtime Extension

Users cannot add custom node types without:
1. Creating a YAML file in `src/core/registry/builtins/`
2. Adding a `?raw` import in loader.ts
3. Rebuilding the app

### Vite-Specific Loading

The `?raw` import pattern only works with Vite. The CLI uses a different loader
(`src/cli/nodeLoader.ts`) that reads from the filesystem. Two separate loading paths
that can drift.

---

## Proposed Solution

### A. Unified NodeDef Loader Architecture

Replace the Vite-specific loading with a multi-source loader:

```
src/core/registry/
  registryCore.ts        -- Keep core registry, but allow runtime additions
  registryManager.ts     -- Keep manager, update to support multiple loaders
  loader.ts              -- Refactor to coordinator
  loaders/
    builtinLoader.ts     -- Loads the 15 built-in types (bundled)
    yamlLoader.ts        -- Loads from YAML strings (shared by all sources)
    urlLoader.ts         -- Loads from URL (community registry)
    fileLoader.ts        -- Loads from local .yaml files (desktop/CLI)
  builtins/
    (keep existing YAML files)
  builtins.generated.ts  -- Build-time generated: all YAML inlined as strings
```

**Build step** (replaces `?raw` imports):
```typescript
// scripts/bundle-nodedefs.ts — run as prebuild step
// Reads all YAML files from builtins/ and generates builtins.generated.ts
// Output: export const BUILTIN_YAMLS: string[] = ['...yaml1...', '...yaml2...'];
```

This eliminates the Vite `?raw` dependency and works in CLI, tests, and production.

### B. Allow Runtime Registration

Make the registry addable at runtime:

```typescript
// registryCore.ts — updated
export class Registry {
  private defs = new Map<string, NodeDef>();

  // Existing: bulk init for builtins
  initBuiltins(defs: NodeDef[]): void {
    for (const def of defs) {
      this.defs.set(def.type, def);
    }
  }

  // New: register individual defs at runtime
  register(def: NodeDef): void {
    this.defs.set(def.type, def);
    this.emit('nodedef:registered', def); // notify UI to update
  }

  // New: unregister
  unregister(type: string): boolean {
    return this.defs.delete(type);
  }

  // New: list sources
  getSources(): Map<string, NodeDefSource> { ... }
}
```

### C. NodeDef Package Format

Standard format for community-contributed node types:

```yaml
# Example: aws-lambda.yaml
metadata:
  type: aws/lambda
  displayName: AWS Lambda
  namespace: aws
  icon: cloud-lightning
  shape: hexagon
  tags: [serverless, aws, compute, function]
  description: AWS Lambda serverless function
  author: community
  version: 1.0.0

spec:
  args:
    runtime:
      type: enum
      options: [nodejs20.x, python3.12, java21, go1.x, dotnet8]
      default: nodejs20.x
      label: Runtime
    memory:
      type: number
      default: 128
      min: 128
      max: 10240
      unit: MB
      label: Memory
    timeout:
      type: number
      default: 30
      max: 900
      unit: seconds
    handler:
      type: string
      default: index.handler

  ports:
    trigger:
      direction: in
      label: Event Source
    response:
      direction: out
      label: Response
    dlq:
      direction: out
      label: Dead Letter Queue
      optional: true

  childSlots: []

ai:
  context: |
    AWS Lambda is a serverless compute service. Functions are triggered by
    events (API Gateway, S3, SQS, etc.) and automatically scale.
    Consider cold start latency, memory/CPU relationship, and timeout limits.
```

### D. Community Registry Protocol

A lightweight protocol for discovering and loading community NodeDefs:

```typescript
// src/core/registry/loaders/urlLoader.ts
export class UrlLoader {
  async loadFromUrl(url: string): Promise<NodeDef[]> {
    const response = await fetch(url);
    const yaml = await response.text();
    return parseNodeDefYaml(yaml);
  }

  async loadFromRegistry(registryUrl: string, query?: string): Promise<NodeDef[]> {
    // Registry returns a list of available NodeDef packages
    const index = await fetch(`${registryUrl}/index.json`);
    const packages = await index.json();
    // Filter by query, load selected packages
  }
}
```

**Initial registry** can be a simple GitHub repo:
```
archcanvas-community-nodedefs/
  index.json                -- Package index
  aws/
    lambda.yaml
    s3.yaml
    dynamodb.yaml
    sqs.yaml
  gcp/
    cloud-run.yaml
    bigquery.yaml
  kubernetes/
    pod.yaml
    service.yaml
    deployment.yaml
    ingress.yaml
  terraform/
    module.yaml
    resource.yaml
```

### E. NodeDef Browser Enhancements

Update the Left Panel to support multiple sources:

```
[Built-in]  [Community]  [Custom]

Search: ____________

compute/
  ▸ Service        (built-in)
  ▸ Function       (built-in)
  ▸ Worker         (built-in)

aws/                (community)
  ▸ Lambda
  ▸ S3 Bucket
  ▸ DynamoDB Table

my-company/         (custom)
  ▸ Payment Service
  ▸ Auth Gateway
```

### F. Tech Stack Templates (Predefined Combinations)

```yaml
# stacks/nextjs-vercel.stack.yaml
metadata:
  name: Next.js on Vercel
  description: Full-stack Next.js with Vercel deployment
  tags: [web, fullstack, nextjs, vercel]
  icon: triangle

nodes:
  - id: frontend
    type: client/web
    displayName: Next.js App
    args:
      framework: Next.js 15

  - id: api
    type: compute/function
    displayName: API Routes
    parent: frontend

  - id: db
    type: data/database
    displayName: PostgreSQL
    args:
      engine: PostgreSQL 16

  - id: cdn
    type: network/cdn
    displayName: Vercel Edge

edges:
  - from: frontend
    to: api
    type: sync
    label: Server Actions
  - from: api
    to: db
    type: sync
    label: Prisma ORM
  - from: cdn
    to: frontend
    type: sync
    label: Edge Cache
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/core/registry/registryCore.ts` | Allow runtime register/unregister |
| `src/core/registry/registryManager.ts` | Support multiple loader sources |
| `src/core/registry/loader.ts` | Refactor to use bundled strings instead of `?raw` |
| `src/cli/nodeLoader.ts` | Align with new loader architecture |
| `src/components/panels/NodeDefBrowser.tsx` | Add source tabs (built-in / community / custom) |

**New files:**
- `src/core/registry/loaders/builtinLoader.ts`
- `src/core/registry/loaders/yamlLoader.ts`
- `src/core/registry/loaders/urlLoader.ts`
- `src/core/registry/loaders/fileLoader.ts`
- `src/core/registry/builtins.generated.ts` (build output)
- `scripts/bundle-nodedefs.ts` (build script)

---

## Acceptance Criteria

1. All 15 built-in NodeDefs still load correctly
2. CLI and web app use the same loading path (no `?raw`)
3. New NodeDef can be registered at runtime via `registry.register(def)`
4. YAML files can be loaded from a URL
5. NodeDef Browser shows source information (built-in vs community)
6. Existing .archc files with built-in node types still open correctly
7. `npm run test` passes
8. `npm run build` succeeds
