# Task 4: CLI Read Commands + Import + Index Wiring

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** CLI read commands bridge routing, import wire format, command wiring
**Parent feature:** [./2026-03-14-ephemeral-bridge-index.md](./2026-03-14-ephemeral-bridge-index.md)

## Write Set

- Modify: `src/cli/commands/list.ts` (~20 lines)
- Modify: `src/cli/commands/describe.ts` (~25 lines)
- Modify: `src/cli/commands/search.ts` (~20 lines)
- Modify: `src/cli/commands/catalog.ts` (~15 lines)
- Modify: `src/cli/commands/import.ts` (~30 lines)
- Modify: `src/cli/index.ts` (~20 lines)

## Read Set (context needed)

- `docs/specs/2026-03-14-ephemeral-bridge-operations-design.md` — design spec (sections 5, 8)
- `src/cli/context.ts` — `loadContext`, `bridgeRequest`, `resolveCanvasId`, `CLIContext` (from Task 1)
- `src/cli/output.ts` — `printSuccess`, `OutputOptions`
- `src/store/fileStore.ts` — `saveAll()` signature

## Dependencies

- **Blocked by:** Task 1 (loadContext changes, bridgeRequest)
- **Blocks:** None

## Description

This task makes read commands bridge-aware and self-contained, updates the import wire format, and adjusts the CLI index wiring.

### 1. Read commands become self-contained (spec §5)

Currently, `list`, `describe`, `search`, and `catalog` are synchronous functions that assume stores are already populated. `loadContext()` is called in the `index.ts` action handlers.

New pattern: each read command becomes async, calls `loadContext()` internally, and checks `ctx.bridgeUrl`:

```
export async function listCommand(flags, options, projectPath?):
  const ctx = await loadContext(projectPath)
  if (ctx.bridgeUrl) {
    const result = await bridgeRequest(ctx.bridgeUrl, 'list', { canvasId, type })
    printSuccess(result.data ?? result, options)
    return
  }
  // existing local logic unchanged
```

This matches the write command pattern where each command is self-contained.

**Signature changes:**
- `listCommand(flags, options)` → `listCommand(flags, options, projectPath?)`
- `describeCommand(flags, options)` → `describeCommand(flags, options, projectPath?)`
- `searchCommand(query, flags, options)` → `searchCommand(query, flags, options, projectPath?)`
- `catalogCommand(flags, options)` → `catalogCommand(flags, options, projectPath?)`

All become `async`.

### 2. Import command changes (spec §8)

Three changes to `import.ts`:

**a) Internal `loadContext()` call:** Remove `CLIContext` parameter. Call `loadContext()` internally (matching write command pattern). Signature: `importCommand(flags, options)` → receives project path from flags or global opts.

**b) Move YAML parsing before bridge guard:** Currently, YAML parsing only happens in the non-bridge path (line 60). Move the `readFile()` + `parseYaml()` before the bridge guard so parsed data is available for the bridge path.

**c) New wire format:** Instead of sending `{ canvasId, yaml: fileContent }`, send `{ canvasId, nodes, edges, entities }` with pre-parsed arrays. The browser dispatcher receives structured data and merges via graphStore.

**d) Move canvas existence check:** Currently checks `fileStore.getCanvas(canvasId)` before the bridge guard (line 32-35). In bridge mode, `fileStore` has no project loaded, so this always fails. Move inside the non-bridge path — the browser dispatcher validates canvas existence.

### 3. Update `index.ts` wiring

Read commands no longer need `loadContext()` in the action handler — the commands handle it internally. Simplify:

```
.action(async (flags) => {
  const globalOpts = program.opts();
  await listCommand(
    { scope: flags.scope, type: flags.type },
    { json: globalOpts.json },
    globalOpts.project,
  );
});
```

Import command also simplifies — no longer passes `ctx`:

```
.action(async (flags) => {
  const globalOpts = program.opts();
  await importCommand(
    { file: flags.file, scope: flags.scope, project: globalOpts.project },
    { json: globalOpts.json },
  );
});
```

### Acceptance Criteria

- All four read commands are async and call `loadContext()` internally
- Read commands route through `bridgeRequest` when bridge detected
- Read commands fall back to existing local logic when no bridge
- Import sends `{ canvasId, nodes, edges, entities }` through bridge (not `{ yaml }`)
- Import calls `loadContext()` internally (no CLIContext parameter)
- Canvas existence check in import is inside non-bridge path
- `index.ts` does not call `loadContext()` for read commands or import
- TypeScript compiles without errors
