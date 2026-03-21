# 31: Delegate Permission Persistence to SDK

> **Date**: 2026-03-22 | **Status**: Complete
> **Scope**: Remove custom `permissionStore.ts` and delegate all permission persistence to the Claude Agent SDK's built-in `settings.json` mechanism

## Recap

This milestone removes the custom permission persistence layer (`permissionStore.ts`, 189 lines) and delegates the entire permission lifecycle to the Claude Agent SDK. Previously, ArchCanvas maintained its own `.archcanvas/permissions.json` file to store "Always Allow" rules, with a hand-rolled `isAutoApproved()` pattern matcher that re-implemented the SDK's built-in rule evaluation. This was redundant — the SDK already has a complete read-check-persist pipeline via its `settingSources` option and `updatedPermissions` return from `canUseTool`.

The key change is adding `settingSources: ['user', 'project', 'local']` to the SDK query options in `claudeCodeBridge.ts`. This makes the SDK read permission rules from all three Claude Code settings layers: `~/.claude/settings.json` (user), `.claude/settings.json` (project), and `.claude/settings.local.json` (local). When a user clicks "Always Allow", each `PermissionUpdate` is mapped to force `destination: 'localSettings'` before being returned to the SDK, ensuring writes always go to `.claude/settings.local.json` (gitignored) rather than the shared project settings.

The `.archcanvas/.gitignore` scaffolding (which wrote `permissions.json\n` during project creation) was also removed from `fileStore.ts` since `permissions.json` is no longer written. Existing `.archcanvas/permissions.json` files in user projects are orphaned but harmless — gitignored and never read.

The investigation started from a question about whether ArchCanvas was piggybacking on Claude Code's settings files. Reading the [SDK permissions docs](https://platform.claude.com/docs/en/agent-sdk/permissions) and [TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript) revealed that the SDK does NOT load filesystem settings by default (`settingSources` defaults to `[]`), and the `canUseTool` return type includes `updatedPermissions?: PermissionUpdate[]` with a `destination` field for controlling where rules are written. This confirmed the custom store was fully redundant.

**Plan**: `docs/plans/2026-03-21-delegate-permissions-to-sdk.md`

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| SDK settings layers to load | `['user', 'project', 'local']` (all three) | `['local']` only | Users expect their global Claude Code deny rules to apply in ArchCanvas. Loading all layers respects the full settings hierarchy. |
| Write destination for "Always Allow" | Force `destination: 'localSettings'` on all `updatedPermissions` | Pass through SDK's suggested destination | Prevents "Always Allow" from writing to shared `.claude/settings.json` (committed to git). Per-developer permissions stay private. |
| Migration of existing `.archcanvas/permissions.json` | No migration — orphan in place | Write a migration script | The file is gitignored and harmless. No user-facing impact from leaving it stale. |
| `.archcanvas/.gitignore` scaffolding | Remove entirely (option A) | Keep with empty content | Nothing else needs gitignoring in `.archcanvas/`. Removing avoids dead scaffolding code. |

## Retrospective

- **What went well** — The SDK documentation at `platform.claude.com` was clear enough to confirm the `settingSources` → `updatedPermissions` → `settings.json` pipeline. The playwright-cli browser test validated the full end-to-end flow: permission card appeared for `curl`, "Always Allow" persisted to `.claude/settings.local.json` line 102, and the old `.archcanvas/permissions.json` was untouched.

- **What didn't** — The initial analysis (before reading the SDK docs) incorrectly assumed the SDK was already reading `~/.claude/settings.json` by default. The docs explicitly state the opposite: "The SDK does not load filesystem settings by default." This led to a corrected understanding but could have been caught earlier by reading the SDK reference first.

- **Lessons** — Always check the SDK's public documentation before assuming inherited behavior. The `settingSources` default of `[]` (isolation mode) is a deliberate design choice, not an oversight. The `updatedPermissions` return field is in the TypeScript types but not prominently documented in the user-facing docs — the TypeScript reference is the authoritative source for SDK capabilities.
