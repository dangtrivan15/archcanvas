# Registry: Install-State Awareness and Built-in Collision Policy

**Date:** 2026-05-09
**Status:** Draft — pending user review

## Problem

Two related defects in the Community-tab install flow:

1. **Install button has no state awareness.** `NodeDefDetailView.tsx:96-102` always renders a primary "Install" button regardless of whether the NodeDef is already installed. A user has no way to tell from the detail view whether the displayed version is installed, outdated, or matches what they have. They can re-trigger an install of a version they already have.

2. **Built-in vs community collisions are silently misleading.** When a community NodeDef shares a key with a built-in (e.g. `network/cdn`):
   - Resolution silently prefers the built-in (`core.ts:48-49`), so the community install is dead weight.
   - The InstalledTab partition (`InstalledTab.tsx:57-68`) classifies the colliding key under "Community-Installed" and excludes it from "Built-in Types," producing the misleading badge mismatch ("32 built-in" vs "Built-in Types (30)") and giving users the false impression that the community version replaced the built-in.

The user has no signal that an install collided, no path to actually use the community version when they want to override the built-in, and no path to undo an install.

## Goals

- Surface install state in the Community detail view: Installed, Update available, Downgrade, Uninstall.
- Allow users to deliberately override a built-in with a community version, with a single explicit consent moment and a persistent visual reminder.
- Provide an Uninstall path that fully removes a community-installed NodeDef.
- Keep resolution behavior internally consistent: deliberate user actions outrank automatic sources.

## Non-goals

- Migration prompts on app upgrade if a future built-in collides with an existing community install. (Override remains in effect; badge surfaces it.)
- Reserved-namespace policy at the registry server. (Out of scope; collision policy is purely client-side.)
- Conflict resolution between community NodeDefs that have different ports/args from the built-in they shadow. (User's responsibility — UI surfaces the override, doesn't validate compatibility.)

## Resolution priority change

Current order in `src-web/core/registry/core.ts:48-49`:

```
authored > remoteOfficial > builtins > remoteInstalled
```

New order:

```
authored > remoteInstalled > remoteOfficial > builtins
```

**Rationale.** The hierarchy now reflects a single principle: more deliberate sources outrank more automatic ones.

| Tier | Source | Why |
|---|---|---|
| Deliberate (user action) | `authored` | User wrote/edited the YAML — most specific. |
| | `remoteInstalled` | User clicked Install — explicit opt-in. |
| Automatic (sync/ship) | `remoteOfficial` | Auto-synced; live from registry but passive. |
| | `builtins` | Shipped with the app — frozen until upgrade. |

Putting `remoteInstalled` above `remoteOfficial` matches the existing rule that `authored` outranks `remoteOfficial`. By symmetry, an explicit user install should outrank a passive auto-sync.

**Implementation.** Two locations in `core.ts`:

```ts
// resolveByKey (was: line 49)
return authored.get(typeKey)
  ?? remoteInstalled?.get(typeKey)
  ?? remoteOfficial?.get(typeKey)
  ?? builtins.get(typeKey);
```

```ts
// allNodeDefs merge order (was: lines 83-87)
// Build lowest-to-highest so last write wins:
//   builtins → remoteOfficial → remoteInstalled → authored
const merged = new Map(builtins);
for (const [key, def] of (remoteOfficial ?? [])) merged.set(key, def);
for (const [key, def] of (remoteInstalled ?? [])) merged.set(key, def);
for (const [key, def] of authored) merged.set(key, def);
```

**Existing-collision behavior.** Existing community installs that collide with built-ins are grandfathered in as overrides — after the change ships, they start being resolved (currently they're ignored). No migration prompt; the persistent override badge (below) surfaces the new state.

## Override warning

Triggered only on the **first-install** path when the target key collides with a built-in: `builtinKeys.has(key) && !remoteInstalledKeys.has(key)`.

Reuses the existing `Dialog` primitive (`src-web/components/ui/dialog.tsx`). Copy:

> **Override built-in `network/cdn`?**
>
> ArchCanvas ships a built-in `network/cdn`. Installing this community version will replace it on this canvas. The built-in remains available — uninstall the community version to restore it.
>
> [Cancel] [Override and Install]

No dialog for Update / Downgrade / Uninstall — the override decision is made once at install time. Re-prompting on every version change would be noise.

The Install button itself signals the collision before the dialog opens: label changes from "Install" to "Install (overrides built-in)" when the collision condition is met.

## Persistent override badge

The InstalledTab already renders an amber `override` badge on rows whose key appears in the `overrides[]` array (`InstalledTab.tsx:140-156`). The array is populated from registry warnings via `extractOverrideKeys` (`registryStore.ts:79-86`), which matches `/^NodeDef '(.+)' overridden/`.

Extend `core.ts:32-46` to emit the same warning shape for `remoteInstalled` keys that shadow either a `builtin` or a `remoteOfficial` (both are now possible under the new priority order):

```ts
for (const key of remoteInstalled?.keys() ?? []) {
  if (authored.has(key)) continue; // already covered by authored override loop
  if (remoteOfficial?.has(key)) {
    warnings.push(
      `NodeDef '${key}' overridden by community install (shadows official registry version)`,
    );
  } else if (builtins.has(key)) {
    warnings.push(
      `NodeDef '${key}' overridden by community install (shadows builtin)`,
    );
  }
}
```

`extractOverrideKeys` requires no change. The badge renders automatically on Community-Installed rows that override built-ins.

## Install button state machine

Lives in `src-web/components/registry/NodeDefDetailView.tsx`. Driven by two values:

- `viewedVersion` = `selectedVersion ?? selectedDetail.version.version`
- `installedVersion` = `remoteInstalledVersions.get(key)`

`registryStore` already exposes `remoteInstalledVersions: Map<string, string>` (line 24). New requirement: expose `builtinKeys: Set<string>` (currently only `builtinCount` is exposed).

| Condition | Primary button | Secondary button |
|---|---|---|
| Not installed, no collision | `Install` | — |
| Not installed, collides with built-in | `Install (overrides built-in)` → opens confirm dialog | — |
| Installed, viewed == installed | `Installed ✓` (disabled) | `Uninstall` |
| Installed, viewed > installed | `Update to v{viewed}` | `Uninstall` |
| Installed, viewed < installed | `Install v{viewed} (downgrade)` | `Uninstall` |

Version comparison uses `parseSemVer` from `core/registry/version.ts` (already imported transitively). When semver parsing fails for either version, fall back to string-equal check for the "Installed" state and treat any difference as "Install v{viewed}" without update/downgrade qualifier.

The Manage section (owner-only, `NodeDefDetailView.tsx:215-230`) keeps its "Install to Workspace" button verbatim. Owners can still re-install for publishing workflows.

## Uninstall flow

New action on `registryStore`:

```ts
async uninstallRemoteNodeDef(
  fs: FileSystem,
  projectRoot: string,
  namespace: string,
  name: string,
): Promise<void>
```

Steps:
1. Compute filename: `${namespace}-${name}.yaml` (matches `installer.ts:50`).
2. `await fs.deleteFile(\`${projectRoot}/.archcanvas/nodedefs/${filename}\`)` — guarded with try/catch so a missing file doesn't block lockfile cleanup.
3. Load lockfile, drop `entries[\`${namespace}/${name}\`]`, save.
4. `await this.reloadProjectLocal(fs, projectRoot)` — registry rebuilds; built-in (if any) reappears via fall-through.
5. `await this.checkForUpdates()` — clears any stale update entry for this key.

UI surfaces:
- `NodeDefDetailView` — secondary "Uninstall" button next to the primary install/update/downgrade button. Triggers a confirm dialog before invoking the action.
- `InstalledTab` — small "×" / "Uninstall" button on Community-Installed rows, parallel to existing Update/Dismiss buttons. Triggers the same confirm dialog.

Confirm dialog copy:

> **Uninstall `network/cdn`?**
>
> The file `.archcanvas/nodedefs/network-cdn.yaml` will be removed and the lockfile entry cleared. {If `builtinKeys.has(key)`:} The built-in `network/cdn` will be used instead. You can re-install from the Community tab at any time.
>
> [Cancel] [Uninstall]

## Affected files (summary)

- `src-web/core/registry/core.ts` — flip resolution priority; emit warnings for community-overrides-builtin collisions.
- `src-web/store/registryStore.ts` — expose `builtinKeys: Set<string>`; add `uninstallRemoteNodeDef` action.
- `src-web/components/registry/NodeDefDetailView.tsx` — install button state machine; collision-aware label; override confirm dialog; uninstall confirm dialog + button.
- `src-web/components/registry/InstalledTab.tsx` — uninstall button + confirm on Community-Installed rows.
- New tests in `test/unit/core/registry/` and `test/unit/components/registry/` for each behavioral change.
- New E2E test for the full install-with-collision-confirm-then-uninstall flow.

## Open questions

None at spec time. Behavior of "viewed version cannot be parsed as semver" is specified above (string-equal fallback) — flag in plan if a more precise approach is preferred.

## Self-review notes

- No placeholders or TBDs.
- Resolution priority section, button state machine, and uninstall flow are mutually consistent (button states use the same `remoteInstalledKeys` and `builtinKeys` as the resolution layer).
- Scope is one feature, suitable for a single implementation plan.
- Ambiguity scan: "viewed version" is unambiguously `selectedVersion ?? selectedDetail.version.version`; collision condition is fully specified; uninstall steps are explicit about file path and lockfile.
