# 29: Entity Creation UI

> **Date**: 2026-03-21 | **Status**: Complete
> **Scope**: Full entity CRUD UI in EntityPanel, edge entity autocomplete with quick-create, 3 new MCP entity tools

## Recap

The entity engine layer (`addEntity`/`removeEntity`/`updateEntity`) was already complete in the graph engine and GraphStore, entities persisted via the YAML codec, and the EntityPanel displayed them read-only. This milestone closed the gap by adding full CRUD UI and AI tool surface for entities.

**Store dispatcher + MCP tools** were implemented first, extending `storeActionDispatcher.ts` with three new action handlers (`addEntity`, `removeEntity`, `updateEntity`) that construct typed objects from flat args before calling GraphStore. Three corresponding MCP tools (`add_entity`, `remove_entity`, `update_entity`) were added to `mcpTools.ts` with Zod schemas and the system prompt updated with entity tool guidance. This gives the AI the same fine-grained entity mutation capability that was previously only available via batch `import_yaml`.

**EntityPanel CRUD** added an inline creation form (`CreateEntityForm` component) with name/description/codeRefs inputs, duplicate detection via the engine's `DUPLICATE_ENTITY` error, and entry-only motion animation (exit animations skipped per project pattern for happy-dom compatibility). Edit mode switches expanded EntityRow from read-only to editable inputs with Save/Cancel. Delete uses a two-step confirm and surfaces `ENTITY_IN_USE` errors showing the user which edges reference the entity.

**Edge autocomplete** replaced the free-form text input in EdgeDetailPanel with a custom combobox. The dropdown filters canvas entities case-insensitively, excludes already-assigned entities, and offers a "Create [name]" quick-create option when no match exists. The quick-create flow handles the `DUPLICATE_ENTITY` race condition gracefully — if the entity was created between render and click, it treats the existing entity as the match and still assigns it to the edge. Keyboard navigation (Arrow/Enter/Escape) and outside-click dismiss are supported.

**Test coverage**: 1477 unit tests (+29 new across 3 files), 95 E2E tests (+3 new), zero regressions. One new test file created (`EdgeDetailPanel.test.tsx`), one new E2E spec (`entity-crud.spec.ts`).

**Spec**: `docs/specs/2026-03-20-entity-creation-ui-design.md`
**Plan**: `docs/plans/2026-03-21-entity-creation-ui.md`

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Entity input UX | Custom combobox (input + filtered `<ul>` + keyboard) | Radix Combobox / cmdk integration | Entity lists are small (<20 per canvas), no virtualization needed. Custom keeps it lightweight with no new dependency. |
| Create form animation | Entry-only `motion.div` | `AnimatePresence` with exit | happy-dom doesn't complete exit animations (known project pattern). Entry-only avoids test flakiness while still providing visual polish. |
| EdgeDetailPanel test approach | Mock `graphStore.updateEdge` directly | `onUpdateEdge` callback prop | Component calls store imperatively, not via callback. Tests verify the real interface. |
| Dropdown item click handler | `onClick` + `onMouseDown={preventDefault}` | `onMouseDown` only | `fireEvent.click` in tests doesn't trigger `onMouseDown`. Split approach works in both tests and browser. |
| uiStore window exposure | Added `__archcanvas_uiStore__` on window | Command palette navigation in E2E | E2E tests need to switch to entity panel mode; no toolbar button exists for entities. Direct state setting is the pragmatic approach matching existing `fileStore`/`graphStore` exposure pattern. |

## Retrospective

- **What went well** — TDD flow was smooth across all 6 tasks. Writing failing tests first caught the `AnimatePresence` exit animation issue early (Task 3) rather than discovering it in CI. The plan's step-by-step structure made execution straightforward.

- **What didn't** — The plan's EdgeDetailPanel test setup assumed an `onUpdateEdge` callback prop that doesn't exist on the real component. Required adapting all test assertions to check `mockGraphState.updateEdge` instead. The plan also referenced `@testing-library/user-event` which isn't a project dependency — switched to `fireEvent` throughout. These were minor but required deviating from the plan.

- **Lessons** — When plans reference component interfaces, verify the actual props before writing tests. Smart quotes (`&ldquo;`/`&rdquo;`) in JSX don't match regex patterns with regular quotes — use plain quotes in user-facing text that tests will match against.

- **Notes for future** — The entity autocomplete combobox uses `useFileStore.getState().getCanvas(canvasId)?.data.entities` in a `useMemo` with `[canvasId]` deps. This means the dropdown won't reactively update if entities are added in another panel while the combobox is open. For the current UX (small entity lists, user-driven flow) this is fine, but if entity creation becomes more concurrent, consider subscribing to the store.
