# Task 3: registryStore

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Reactive NodeDef registry bridge
**Parent feature:** [I2 Canvas Rendering](./2026-03-12-i2-canvas-rendering-index.md)

## Write Set

- Create: `src/store/registryStore.ts` (~60 lines)
- Test: Create `test/unit/store/registryStore.test.ts`

## Read Set (context needed)

- `src/core/registry/core.ts` — `NodeDefRegistry` interface (resolve, list, search, listByNamespace)
- `src/core/registry/index.ts` — barrel exports, `loadBuiltins`, `createRegistry`
- `src/store/fileStore.ts` — pattern reference for Zustand store with `create()`
- `src/store/uiStore.ts` — simpler pattern reference
- `docs/specs/2026-03-12-i2-canvas-rendering-design.md` — registryStore interface

## Dependencies

- **Blocked by:** None (first task)
- **Blocks:** Task 4 (graphStore uses registryStore for validation), Task 14 (command palette searches registry)

## Description

Create a Zustand store that wraps the I3 NodeDef registry, making it reactive for React components. This is a thin delegation layer — the real logic lives in the core registry module.

### Interface

```typescript
interface RegistryStoreState {
  registry: NodeDefRegistry | null;
  status: 'idle' | 'loading' | 'ready' | 'error';

  initialize(fs?: FileSystem): Promise<void>;
  resolve(type: string): NodeDef | undefined;
  list(): NodeDef[];
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}
```

### Implementation notes

- `initialize()`: Call `loadBuiltins()` (sync — uses `?raw` imports) to get built-in defs. For now, project-local loading is deferred (the `fs` parameter exists for forward-compatibility but can be ignored in this task — just load built-ins). Set `status` to `'ready'` after loading.
- `resolve`, `list`, `search`, `listByNamespace`: Delegate to `this.registry?.method()`. When `registry` is null (before init), return `undefined` / `[]` / `[]` / `[]` — safe no-ops.
- Use `loadBuiltins()` and `createRegistry()` from `src/core/registry/index.ts`.

### Tests

- `initialize` sets status to 'ready' and populates registry
- `resolve` returns a NodeDef for a known built-in type (e.g., 'compute/service')
- `resolve` returns undefined for unknown type
- `list` returns all built-in defs (32 expected)
- `search` finds matching defs
- `listByNamespace` filters by namespace
- All methods return safe defaults before initialization
- Status lifecycle: idle → loading → ready

### Acceptance Criteria

- registryStore created with full interface
- Delegates to core registry — no duplicated logic
- Null-safe before initialization
- All 32 built-in NodeDefs accessible after `initialize()`
- `tsc --noEmit` passes
