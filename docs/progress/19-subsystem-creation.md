# 19: Subsystem Creation

> **Date**: 2026-03-18 | **Status**: Complete
> **Scope**: Enable users and AI to create subsystem canvases (nested scopes) from the UI and via MCP tools

## Recap

ArchCanvas already supported subsystem canvases at the engine, navigation, and rendering layers — RefNodes pointed to separate YAML files, and users could dive in/out of scopes. What was missing was a *creation pipeline*: neither the UI nor the AI could create a subsystem without manually authoring YAML.

This milestone added subsystem creation end-to-end across all layers:

1. **Store layer** — `fileStore.registerCanvas()` registers new canvas entries in the project Map without I/O (the actual file is created on save). `graphStore.createSubsystem()` orchestrates the full flow: validate type → register canvas → add RefNode to parent → push undo patches → mark both canvases dirty.

2. **AI layer** — A new `create_subsystem` MCP tool lets the AI create nested scopes. The system prompt now includes a "Subsystems" section teaching the AI about the creation workflow, scope parameters, and cross-scope edge syntax. The stale `archcanvas catalog --json` CLI reference in `addNodeValidation.ts` was cleaned up.

3. **UI layer** — Two entry points: a "Create Subsystem..." context menu item on the canvas background, and a "Create Subsystem..." action in the command palette. Both open the palette in a new "subsystem" mode that shows only node types. Selecting a type opens the `CreateSubsystemDialog` — a Radix Dialog with name/ID/filename fields, auto-derivation via `deriveId()`, user-overridable fields, and client-side collision checks.

4. **Testing** — 20 new unit tests (deriveId, registerCanvas, createSubsystem, dispatcher), 7 new E2E tests (context menu creation, palette action creation, navigation in/out, inner nodes, collision errors, save verification, cross-scope edges). Total: 1396 unit tests (up from 1376), 77 E2E tests (up from 70).

**What's next**: The E2E mock bridge test (deferred from Tauri validation) and the `bun` PATH fix for `beforeBuildCommand` remain as the next items. No new blockers were introduced.

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Canvas registration before node ID check | Register canvas first, then add RefNode | Check node uniqueness before registration (as originally planned) | The plan's ordering hit `DUPLICATE_NODE_ID` before `CANVAS_ALREADY_EXISTS` on duplicate calls. Swapping prioritizes the more specific error. Orphaned canvases are inert per the spec's undo consideration. |
| Dialog rendered at Canvas level | Sibling to CommandPalette | Nested inside CommandPalette | Radix Dialog focus traps conflict when nested — the inner dialog steals focus from the outer `cmdk` dialog, breaking keyboard navigation. Canvas-level rendering gives each dialog independent focus management. |
| `setTimeout(0)` for palette action | Defer event dispatch | Synchronous dispatch | The "Create Subsystem" command palette action dispatches `archcanvas:open-palette`. Synchronous dispatch opens the palette, then `handleSelect`'s `onClose()` immediately closes it. `setTimeout(0)` ensures the close runs first, then the event reopens in subsystem mode. |
| Cross-scope edge test via store data | Assert edge count in store | Assert rendered edge count via `.react-flow__edge` | Cross-scope edges (`@subsystem/node`) exist in the data model but don't render visually at the root level — they appear as ghost/inherited edges when diving into the subsystem. The store assertion tests the right thing. |

## Retrospective

- **What went well** — The TDD workflow was smooth across all 8 tasks. Each task was self-contained with clear test → implement → verify cycles. The existing engine, navigation, and rendering layers required zero changes — they already handled RefNodes correctly, validating the original architecture decisions from I2/I4.

- **What didn't** — The plan had an ordering conflict between the `createSubsystem` implementation (node ID check before canvas registration) and the test expectations (expecting `CANVAS_ALREADY_EXISTS` on duplicate). This required swapping steps 3 and 4, which also meant accepting orphaned canvases on node ID collisions — a trade-off the spec already documented as acceptable. The `diveIntoSubsystem` E2E helper's `getByText('Dive In')` matched both the context menu button and the node's hint paragraph, requiring a switch to `getByRole('button')`.

- **Lessons** — When a plan specifies both implementation order and test expectations, verify they're consistent before implementing. Also, Playwright's `getByText` is fragile when the same phrase appears in both interactive elements and descriptive text — prefer `getByRole` for buttons.
