# Delegate Permission Persistence to SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the custom `permissionStore.ts` module and delegate all permission persistence to the Claude Agent SDK's built-in `settings.json` mechanism.

**Architecture:** Add `settingSources: ['user', 'project', 'local']` to the SDK query options so it reads permission rules from all three Claude Code settings layers. When the user clicks "Always Allow", override `destination` to `'localSettings'` on every `PermissionUpdate` before returning from `canUseTool`, so writes always go to `.claude/settings.local.json` (gitignored). Remove the custom `isAutoApproved()` early-return — the SDK now handles auto-approval at step 4 of its evaluation flow before `canUseTool` is ever called.

**Tech Stack:** Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), Vitest

**Conscious decisions:**
- `settingSources: ['project']` gates CLAUDE.md loading in the SDK, but we pass a custom `systemPrompt` string (not the preset), so CLAUDE.md is not injected into the prompt.
- `settingSources: ['user']` loads `~/.claude/settings.json` which may contain global hooks. This is acceptable — users expect their Claude Code settings to apply when using the SDK. Hook errors are handled by the SDK internally.
- Existing `.archcanvas/permissions.json` files in user projects become orphaned but harmless (gitignored, no code reads them). No migration needed.

---

### Task 1: Remove `permissionStore` from `claudeCodeBridge.ts` and wire SDK settings

**Files:**
- Modify: `src/core/ai/claudeCodeBridge.ts:22-25,163-170,359-478,498-521`
- Delete: `src/core/ai/permissionStore.ts`
- Delete: `test/ai/permissionStore.test.ts`
- Modify: `test/ai/types-and-prompt.test.ts` (if it imports permissionStore)

**Context (read but don't modify):**
- `src/core/ai/types.ts` — `PermissionSuggestion` type (unchanged)
- `src/core/ai/bridgeServer.ts:213-222` — how sessions are created with `allowedTools`
- `test/ai/bridge-permissions.test.ts` — existing bridge permission tests (pass without changes)
- SDK reference: `PermissionResult`, `PermissionUpdate`, `PermissionUpdateDestination` types

- [ ] **Step 1: Remove permissionStore import and saved state**

In `src/core/ai/claudeCodeBridge.ts`, remove the import and the in-memory state:

```typescript
// DELETE this import (line 25):
import { loadPermissions, savePermission, isAutoApproved } from './permissionStore';

// DELETE this line (line 170):
let savedPermissions = loadPermissions(cwd);
```

- [ ] **Step 2: Add `settingSources` to SDK query options**

In `src/core/ai/claudeCodeBridge.ts`, inside the `sendMessage` method's `fn()` call (around line 361), add `settingSources` to the options object:

```typescript
const sdkQuery = fn({
  prompt: content,
  options: {
    systemPrompt,
    cwd: resolvedCwd,
    abortController,
    ...(sessionId ? { resume: sessionId } : {}),
    settingSources: ['user', 'project', 'local'],       // ← ADD
    tools: ['Bash', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'AskUserQuestion'],
    // ... rest unchanged
```

- [ ] **Step 3: Remove `isAutoApproved` check from `canUseTool`**

In the `canUseTool` callback (around lines 430-433), remove the early-return block:

```typescript
// DELETE this block:
// Auto-approve if the tool matches a saved "Always Allow" rule
if (isAutoApproved(savedPermissions, toolName, input)) {
  return { behavior: 'allow' as const, updatedInput: input };
}
```

The SDK now handles auto-approval at its allow-rules step before `canUseTool` is ever called.

- [ ] **Step 4: Override `destination` to `'localSettings'` on `updatedPermissions`**

In the `canUseTool` callback, when building the allow response (around lines 462-470), map each permission to force `destination: 'localSettings'`:

```typescript
if (response.allowed) {
  const updatedPermissions = response.updatedPermissions?.map(
    (p) => ({ ...p, destination: 'localSettings' as const }),
  ) as PermissionUpdate[] | undefined;
  return {
    behavior: 'allow' as const,
    updatedInput: input,
    ...(updatedPermissions ? { updatedPermissions } : {}),
  };
}
```

- [ ] **Step 5: Remove `savePermission` / `loadPermissions` from `respondToPermission`**

In the `respondToPermission` method (around lines 498-521), remove the disk persistence logic. The SDK handles persistence via the `updatedPermissions` returned from `canUseTool`. The method becomes:

```typescript
respondToPermission(
  id: string,
  allowed: boolean,
  options?: {
    updatedPermissions?: PermissionSuggestion[];
    interrupt?: boolean;
  },
): void {
  const pending = pendingPermissions.get(id);
  if (pending) {
    pending.resolve({
      allowed,
      updatedPermissions: options?.updatedPermissions,
      interrupt: options?.interrupt,
    });
  }
},
```

- [ ] **Step 6: Run existing tests to check for breakage**

Run: `npm run test -- --run`
Expected: All tests pass except `test/ai/permissionStore.test.ts` (which we're about to delete). No other test imports `permissionStore`.

- [ ] **Step 7: Delete `permissionStore.ts` and its test**

```bash
rm src/core/ai/permissionStore.ts
rm test/ai/permissionStore.test.ts
```

- [ ] **Step 8: Run tests to confirm clean deletion**

Run: `npm run test -- --run`
Expected: All tests pass. No imports of `permissionStore` remain.

- [ ] **Step 9: Commit**

```bash
git add src/core/ai/claudeCodeBridge.ts src/core/ai/permissionStore.ts test/ai/permissionStore.test.ts
git commit -m "refactor: delegate permission persistence to SDK settings.json

Remove custom permissionStore.ts (189 lines) and its test file.
Add settingSources: ['user', 'project', 'local'] so the SDK reads
permission rules from all three Claude Code settings layers.
Override destination to 'localSettings' on updatedPermissions so
'Always Allow' decisions write to .claude/settings.local.json (gitignored).
The SDK's built-in evaluation flow now handles auto-approval — canUseTool
is only called for genuinely new permission decisions."
```

---

### Task 2: Remove `.archcanvas/.gitignore` scaffolding from `fileStore.ts`

**Files:**
- Modify: `src/store/fileStore.ts:417-420`
- Modify: `test/unit/store/fileStore-onboarding.test.ts:318-337`

**Context (read but don't modify):**
- `src/store/fileStore.ts:410-434` — the `completeOnboarding` scaffolding section

- [ ] **Step 1: Update existing tests to remove `.gitignore` expectations**

In `test/unit/store/fileStore-onboarding.test.ts`, replace the two `.gitignore` tests (lines 318-337):

Delete the test `'creates .archcanvas/.gitignore with permissions.json entry'` (lines 318-326).

Update the test `'does not overwrite existing .archcanvas/.gitignore'` (lines 328-337) to instead verify `.archcanvas/.gitignore` is NOT created:

```typescript
it('does not create .archcanvas/.gitignore', async () => {
  const fs = new InMemoryFileSystem('NewDir');
  useFileStore.setState({ fs, status: 'needs_onboarding' });

  await useFileStore.getState().completeOnboarding('blank');

  expect(await fs.exists('.archcanvas/.gitignore')).toBe(false);
});
```

- [ ] **Step 2: Run the updated test to see it fail**

Run: `npm run test -- --run test/unit/store/fileStore-onboarding.test.ts`
Expected: FAIL — `fileStore.ts` still writes `.archcanvas/.gitignore`

- [ ] **Step 3: Remove `.gitignore` scaffolding from `fileStore.ts`**

In `src/store/fileStore.ts`, delete lines 417-420:

```typescript
// DELETE these lines:
// 2. Write .gitignore (skip if already present — user may have customized it)
if (!(await fs.exists('.archcanvas/.gitignore'))) {
  await fs.writeFile('.archcanvas/.gitignore', 'permissions.json\n');
}
```

Then renumber the remaining step comments:
- `// 3. Write main.yaml` → `// 2. Write main.yaml`
- `// 4. Load the project` → `// 3. Load the project`
- `// 5. Update recents` → `// 4. Update recents`
- `// 6. AI path` → `// 5. AI path`

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm run test -- --run test/unit/store/fileStore-onboarding.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npm run test -- --run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/store/fileStore.ts test/unit/store/fileStore-onboarding.test.ts
git commit -m "chore: remove .archcanvas/.gitignore scaffolding

permissions.json is no longer written (SDK handles persistence in
.claude/settings.local.json), so the .gitignore entry is unnecessary."
```
