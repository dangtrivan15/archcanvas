# Task 1: Extract Shared addNode Validation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** DRY up duplicated addNode validation logic
**Parent feature:** [Phase 13 Index](./2026-03-15-refactor-cleanup-index.md)

## Write Set

- Create: `src/core/validation/addNodeValidation.ts` (~80 lines)
- Create: `test/unit/core/validation/addNodeValidation.test.ts` (test, unlimited)
- Modify: `src/cli/commands/add-node.ts:39-99` (~-55 lines, replace with shared call)
- Modify: `src/core/ai/webSocketProvider.ts:315-383` (~-60 lines, replace with shared call)

## Read Set (context needed)

- `src/cli/commands/add-node.ts` — current CLI validation (lines 39–99, non-bridge path)
- `src/core/ai/webSocketProvider.ts` — current bridge validation (lines 315–383, `dispatchAddNode`)
- `src/store/registryStore.ts` — registry interface (`resolve`, `search`, `listByNamespace`)
- `src/types/nodeDefSchema.ts` — `NodeDef` type
- `src/types/schema.ts` — `InlineNode` type
- `src/cli/errors.ts` — `CLIError` class (CLI caller wraps result into this)
- `test/unit/cli/commands/add-node.test.ts` — existing CLI tests (must still pass)

## Dependencies

- **Blocked by:** Nothing (independent)
- **Blocks:** Task 5 (rename will touch these files; extract first to avoid conflicts)

## Description

The addNode validation logic — type resolution with dot→slash substitution, fuzzy search for suggestions, args JSON parsing, displayName resolution — is duplicated nearly identically in two places:

1. `src/cli/commands/add-node.ts:39-99` (non-bridge CLI path)
2. `src/core/ai/webSocketProvider.ts:315-383` (`dispatchAddNode` browser dispatcher)

Extract this into a pure function in `src/core/validation/addNodeValidation.ts` that:

1. Takes `{ type, name?, args? }` and a registry interface (`{ resolve, search, listByNamespace }`)
2. Returns a discriminated union result:
   - Success: `{ ok: true, node: InlineNode, resolvedType: string }`
   - Failure: `{ ok: false, code: string, message: string }`

The registry interface should be a minimal pick-type from `RegistryStoreState`, not a direct store dependency. This keeps the validation function pure and testable without Zustand.

### Implementation approach

```typescript
// src/core/validation/addNodeValidation.ts

import type { NodeDef } from '@/types/nodeDefSchema';
import type { InlineNode } from '@/types/schema';

/** Minimal registry interface for addNode validation (no Zustand dependency). */
export interface NodeDefLookup {
  resolve(type: string): NodeDef | undefined;
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}

export type AddNodeInput = {
  id: string;
  type: string;
  name?: string;
  args?: string;
};

export type AddNodeResult =
  | { ok: true; node: InlineNode; resolvedType: string }
  | { ok: false; code: string; message: string };

export function validateAndBuildNode(
  input: AddNodeInput,
  registry: NodeDefLookup,
): AddNodeResult {
  // 1. Resolve type (with dot→slash substitution)
  // 2. If not found, build hint message with fuzzy search
  // 3. Parse args JSON
  // 4. Resolve displayName
  // 5. Return InlineNode
}
```

### Callers after refactor

**CLI (`add-node.ts`):** Replace lines 39–99 with:
```typescript
const result = validateAndBuildNode(
  { id: options.id, type: options.type, name: options.name, args: options.args },
  useRegistryStore.getState(),
);
if (!result.ok) {
  throw new CLIError(result.code, result.message);
}
// result.node is the InlineNode, proceed to addNode + save
```

**Bridge (`webSocketProvider.ts`):** Replace `dispatchAddNode` body with:
```typescript
const result = validateAndBuildNode(
  { id, type, name, args: rawArgs },
  useRegistryStore.getState(),
);
if (!result.ok) {
  return { ok: false, error: { code: result.code, message: result.message } };
}
return useGraphStore.getState().addNode(canvasId, result.node);
```

### Testing strategy

Test the shared function directly (no store mocks needed — inject a fake `NodeDefLookup`):

1. Valid type resolves → returns `{ ok: true, node }` with correct displayName
2. Dot notation resolves via substitution → `compute.service` → `compute/service`
3. Unknown type → `{ ok: false }` with hint message including similar types
4. Unknown type with dot → hint includes "Did you mean?" suggestion
5. Invalid JSON args → `{ ok: false, code: 'INVALID_ARGS' }`
6. Valid JSON args → parsed and included in node
7. Name override → uses provided name instead of NodeDef displayName
8. No name provided → falls back to NodeDef displayName

Existing CLI tests (`test/unit/cli/commands/add-node.test.ts`) must still pass unchanged — they exercise the full CLI flow including the shared function.

### Acceptance criteria

- [ ] `src/core/validation/addNodeValidation.ts` exists with `validateAndBuildNode`
- [ ] `add-node.ts` non-bridge path uses `validateAndBuildNode` (no inline validation)
- [ ] `webSocketProvider.ts` `dispatchAddNode` uses `validateAndBuildNode` (no inline validation)
- [ ] New unit tests cover all 8 scenarios above
- [ ] Existing CLI add-node tests pass unchanged
- [ ] Existing bridge dispatcher tests pass unchanged
