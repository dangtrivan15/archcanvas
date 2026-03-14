# Task 1: CLI Node Type Discovery

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** CLI node type discovery and AI system prompt documentation
**Parent feature:** [AI Chat Bugfixes Index](./2026-03-14-ai-chat-bugfixes-index.md)

## Write Set

- Create: `src/cli/commands/catalog.ts` (~50 lines)
- Modify: `src/cli/index.ts` (~15 lines — register catalog command)
- Modify: `src/cli/commands/add-node.ts` (~20 lines — improve error message)
- Modify: `src/core/ai/systemPrompt.ts` (~15 lines — document catalog + format)

Tests:
- Create: `test/cli/catalog.test.ts`

## Read Set (context needed)

- `src/core/registry/core.ts` — `NodeDefRegistry` interface (`resolve`, `list`, `search`, `listByNamespace`)
- `src/core/registry/loader.ts` — `loadBuiltins()`, key format `namespace/name` at line 17
- `src/store/registryStore.ts` — store wrapper methods
- `src/types/nodeDefSchema.ts` — `NodeDef` type shape (metadata fields)
- `src/cli/errors.ts` — `CLIError` constructor
- `src/cli/output.ts` — `printSuccess`, `OutputOptions` interface
- `src/cli/context.ts` — `loadContext()` pattern
- `src/core/registry/builtins/index.ts` — full list of builtin NodeDefs (for verifying test output)

## Dependencies

- **Blocked by:** None
- **Blocks:** None

## Description

### Part A: `catalog` Command (Bug 1)

Create a new CLI command `archcanvas catalog` that lists all registered node types from the registry. This is a **read-only** command (no mutations, no save needed).

**Command signature:**
```
archcanvas catalog [--namespace <ns>] [--json]
```

**Behavior:**
1. Call `loadContext()` to initialize the registry (same as `list`, `describe`, `search`)
2. If `--namespace` is provided, call `registryStore.listByNamespace(ns)`; otherwise call `registryStore.list()`
3. For each `NodeDef`, output: type key (`namespace/name`), `displayName`, `namespace`, `description`, `tags`
4. Group by namespace in human-readable output; flat array in `--json` output

**JSON output shape:**
```json
{
  "nodeTypes": [
    {
      "type": "compute/service",
      "displayName": "Service",
      "namespace": "compute",
      "description": "A running service or process",
      "tags": ["compute", "runtime"]
    }
  ]
}
```

**Human-readable output shape:**
```
compute
  compute/service          Service              A running service or process
  compute/function         Function             A serverless function
  compute/container        Container            A container or pod
  ...

data
  data/database            Database             A persistent data store
  ...
```

**Implementation pattern:** Follow the same structure as `list.ts` — accept flags, call registry, format output. No bridge path needed (read-only, registry is local).

### Part B: Better Error Message (Bug 2)

Improve the `UNKNOWN_NODE_TYPE` error in `add-node.ts` to:

1. **State the expected format:** "Node types use the format `namespace/name`"
2. **Show similar types:** Use `registryStore.search()` with the user's input to find up to 3 matches
3. **Suggest the catalog command:** "Run `archcanvas catalog --json` to see all available types"

**Example improved error:**
```
Node type 'system.service' is not registered.
Node types use the format 'namespace/name'.
Did you mean: compute/service, network/service-mesh?
Run 'archcanvas catalog --json' to see all available types.
```

The search should try matching against:
- The full input as-is (catches partial matches like "service")
- If input contains `.`, also try replacing `.` with `/` and checking for an exact match

### Part C: System Prompt Updates (Bugs 1 + 2)

Update `buildSystemPrompt()` to add:

1. The `catalog` command in the command list:
   ```
   archcanvas catalog [--namespace <ns>] --json
   ```

2. A new section or note about node type format:
   ```
   ## Node Types
   Node types use the format `namespace/name` (e.g., `compute/service`, `data/database`).
   Use `archcanvas catalog --json` to discover all available types before adding nodes.
   ```

3. A guideline update:
   ```
   - Before adding nodes, use `catalog --json` to discover available node types and their correct identifiers.
   ```

### Acceptance Criteria

- `archcanvas catalog --json` returns all 32 builtin NodeDefs with correct keys
- `archcanvas catalog --namespace compute --json` filters to compute namespace only
- `archcanvas add-node --type system.service` shows helpful error with format hint and suggestions
- System prompt includes catalog command and format documentation
- All existing CLI tests still pass
