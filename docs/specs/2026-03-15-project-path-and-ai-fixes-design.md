# Project Path CWD + AI Chat Fixes

> **Date**: 2026-03-15 | **Phase**: Spec
> **Scope**: Fix AI bridge CWD to use the user's project directory, add hard guard for project path, add max-turns auto-continue, enforce one-project-per-tab

## Problem

Two bugs discovered during I6b testing:

1. **Wrong CWD**: The AI bridge creates sessions with `cwd: process.cwd()` (the archcanvas repo directory). When a user opens a different project (e.g., `~/GitProjects/pjhoon`), Claude Code explores the archcanvas codebase instead of the user's project. The init prompt mentions "ArchCanvas" as a tool name, which compounds the confusion.

2. **Max-turns exhaustion**: When Claude hits `maxTurns: 50` during a large codebase analysis, the session ends with an error. The user must manually type "Continue" to resume. For automated init flows, the app should handle this automatically.

Additionally, project switching within a tab leaves stale state across multiple stores (chatStore, graphStore, canvasStore, etc.). Rather than implementing complex cross-store reset logic, we adopt a **one-project-per-tab** model.

## Design Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Project isolation | One project per tab/window | In-tab project switching with store resets | Eliminates stale state entirely; matches IDE mental model (VS Code = one window per project); no cross-store reset logic needed |
| Path source for web | User enters path in wizard | Auto-detect from directory name | `FileSystemDirectoryHandle` hides absolute paths (browser security); searching by name is fragile; explicit input is reliable |
| Path guard location | Hard guard in `chatStore.sendMessage()` | UI-only guard in ChatPanel | Prevents programmatic bypass (e.g., `completeOnboarding` auto-sends init prompt via `setTimeout`) |
| Bridge CWD | Set from `context.projectPath` per-query | Session-level `cwd` only | `cwd` only affects session creation (SDK ignores it on `resume`); per-query is harmless and future-proofs for any edge case |
| Max-turns handling | Auto-continue with retry cap | Manual "Continue" by user | Init flows are automated; manual intervention breaks the flow; retry cap (3) prevents infinite loops |

## §1 — `FileSystem.getPath(): string | null`

Add to the `FileSystem` interface:

```typescript
export interface FileSystem {
  getName(): string;
  getPath(): string | null;  // NEW — absolute path, null if unknown (Web/InMemory)
  readFile(path: string): Promise<string>;
  // ...
}
```

Implementations:

| Impl | Returns | Source |
|------|---------|--------|
| `NodeFileSystem` | `this.rootPath` | Constructor resolves to absolute path |
| `TauriFileSystem` | `this.rootPath` | Constructor receives absolute path |
| `WebFileSystem` | `null` | `FileSystemDirectoryHandle` hides absolute paths |
| `InMemoryFileSystem` | `null` | Test-only, no real path |

> **Note**: Node/Tauri implementations return the path but are not actively used in this round (the app runs in the browser via `vite dev`). The interface is defined now so the plumbing is ready when Node/Tauri paths are exercised. A TODO is added to the v2 design doc for I7.

## §2 — `fileStore.projectPath`

New state field and setter:

```typescript
interface FileStoreState {
  // ...existing fields...
  projectPath: string | null;
  setProjectPath: (path: string) => void;
}
```

**Auto-set in `openProject()`**: After setting `fs`, call `fs.getPath()`. If non-null, set `projectPath` automatically.

```typescript
// Inside openProject, after setting fs + status:
const detectedPath = fs.getPath();
if (detectedPath) {
  set({ projectPath: detectedPath });
}
```

**Manual set via `setProjectPath()`**: For the web case, the wizard calls this after the user enters the path.

**Set in `openProject()`**: After setting `fs` and `status`, `openProject` sets `projectPath` from `fs.getPath()`. If `getPath()` returns `null` (Web), `projectPath` is left unchanged — it may have been set externally by `setProjectPath()` (e.g., from the wizard). Only a fresh `openProject` call on a **different** fs clears a stale path.

```typescript
// Inside openProject, after setting fs + status:
const detectedPath = fs.getPath();
if (detectedPath) {
  set({ projectPath: detectedPath });
}
// If detectedPath is null (Web), do NOT overwrite — preserve any manually-set path
```

## §3 — Hard Guard in `chatStore.sendMessage()`

At the top of `sendMessage()`, before any other logic:

```typescript
async sendMessage(content: string) {
  // Hard guard: project path required for AI chat
  const projectPath = useFileStore.getState().projectPath;
  if (!projectPath) {
    set({ error: 'Project path is required for AI chat. Set it in project settings.' });
    return;
  }
  // ...existing guards and logic...
}
```

This prevents both manual chat and programmatic calls (e.g., from `completeOnboarding`) from reaching the bridge without a valid path.

## §4 — `assembleContext()` Uses Real Path

In `chatStore.ts`, update `assembleContext()`:

```typescript
function assembleContext(): ProjectContext {
  const fileState = useFileStore.getState();
  const navState = useNavigationStore.getState();

  return {
    projectName: fileState.project?.root.data.project?.name ?? 'Untitled',
    projectDescription: fileState.project?.root.data.project?.description ?? undefined,
    currentScope: navState.currentCanvasId,
    projectPath: fileState.projectPath ?? '.',  // real path instead of hardcoded '.'
  };
}
```

This flows into both:
- **System prompt** via `buildSystemPrompt(context)` → `- **Path:** ${context.projectPath}`
- **Bridge session CWD** (see §5)

## §5 — Bridge CWD from `context.projectPath`

In `claudeCodeBridge.ts`, update `sendMessage` to use the project path from context:

```typescript
const sdkQuery = fn({
  prompt: content,
  options: {
    systemPrompt,
    cwd: context.projectPath || cwd,  // prefer project path over session default
    // ...rest unchanged
  },
});
```

The SDK behavior (confirmed from docs):
- **First query** (no `resume`): `cwd` sets the initial working directory for the Claude Code subprocess
- **Subsequent queries** (with `resume`): SDK preserves the session's own CWD state; the `cwd` option is effectively ignored
- This means the project path correctly sets the starting directory, and if Claude `cd`s during exploration, that's preserved across turns

## §6 — `AiSurveyStep` — Project Path Field

Add a required "Project path" text input to the AI survey form.

**Field details**:
- Label: "Project Path"
- Placeholder: `"/Users/you/projects/my-app"`
- Required: yes (Start button disabled when empty, same as description)
- Pre-filled with `fs.getPath()` if available (Node/Tauri), empty for Web

**Flow**:
1. User fills in the path in the survey form
2. On "Start" click, calls `completeOnboarding('ai', survey)` — survey includes `projectPath`
3. `completeOnboarding` scaffolds `.archcanvas/main.yaml`, calls `openProject(fs)`
4. `openProject` sets `fs` + `status: 'loaded'` — since `fs.getPath()` returns `null` (Web), `projectPath` is **not overwritten** (see §2)
5. After `openProject` returns, `completeOnboarding` calls `setProjectPath(survey.projectPath)` — this sets the path **after** `openProject` has finished
6. `completeOnboarding` then sends the init prompt via `sendMessage` — the hard guard passes because `projectPath` is now set

**Critical sequencing**: `setProjectPath` MUST be called after `openProject` completes, not before, because `openProject` may reset the path if `fs.getPath()` returns a value. For Web (where `getPath()` is `null`), `openProject` leaves `projectPath` unchanged, but the explicit ordering prevents future bugs.

**Update `SurveyData` type**:
```typescript
export interface SurveyData {
  description: string;
  techStack: string[];
  explorationDepth: 'full' | 'top-level' | 'custom';
  customDepth?: number;
  focusDirs: string;
  projectPath: string;  // NEW
}
```

**Update `completeOnboarding`**: After the `openProject(fs)` call and recents update, set the project path from the survey before sending the init prompt:
```typescript
// After openProject and recents update:
if (get().status === 'loaded' && type === 'ai' && survey) {
  get().setProjectPath(survey.projectPath);
}
// Then send init prompt...
```

## §7 — `assembleInitPrompt` Includes Path

Add the project path to the init prompt so Claude knows exactly where to explore:

```typescript
export function assembleInitPrompt(projectName: string, survey: SurveyData): string {
  // ...existing depth/focus/techStack logic...

  return `I'd like you to analyze this codebase and create an architecture diagram using ArchCanvas.

Project: ${projectName}
Description: ${survey.description}
Tech stack: ${techStackText}
Project path: ${survey.projectPath}

IMPORTANT: The project to analyze is located at "${survey.projectPath}".
Explore THAT directory, not the ArchCanvas tool's own source code.

Exploration instructions:
- Depth: ${depthText}
- Focus: ${focusText}

Please:
1. Explore the project structure and key configuration files
...`;
}
```

## §8 — One Project Per Tab

When `open()` or `newProject()` is called and a project is already loaded (`fs !== null`), open a new browser tab instead of switching in-place.

```typescript
open: async () => {
  if (get().fs) {
    window.open('/?action=open', '_blank');
    return;
  }
  // ...existing picker logic
},

newProject: async () => {
  if (get().fs) {
    window.open('/?action=new', '_blank');
    return;
  }
  // ...existing picker logic
},
```

**Auto-trigger from URL param**: `ProjectGate` reads `?action=open` or `?action=new` from the URL on mount and auto-fires the corresponding method. This provides a seamless experience — the user clicks "Open Project" in the menu, a new tab opens, and the directory picker appears automatically.

```typescript
// In ProjectGate, on mount:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (action === 'open') {
    // Clear the param to prevent re-triggering on refresh
    window.history.replaceState({}, '', '/');
    useFileStore.getState().open();
  } else if (action === 'new') {
    window.history.replaceState({}, '', '/');
    useFileStore.getState().newProject();
  }
}, []);
```

**For Tauri desktop**: `window.open()` opens a new OS window. Same behavior, no special handling needed.

## §9 — Max-Turns Auto-Continue

When `chatStore` receives an error event indicating max-turns exhaustion, automatically send "Continue" to resume the analysis.

**Detection**: The SDK emits a `result` message with `subtype: 'error'` when max turns is reached. In the bridge's `translateSDKStream`, this becomes a `ChatEvent` with `type: 'error'`. The error message contains "max turns" or similar.

**Implementation**: Add a store field `_autoContinueCount: number` (not exposed to UI) and an internal helper `_sendMessageInternal(content, isAutoContinue)`. The public `sendMessage` resets the counter and delegates to the internal helper. The internal helper handles the auto-continue logic.

```typescript
// Store state:
_autoContinueCount: 0,

// Public API — resets counter on each user-initiated message:
async sendMessage(content: string) {
  set({ _autoContinueCount: 0 });
  await get()._sendMessageInternal(content);
},

// Internal — handles auto-continue:
async _sendMessageInternal(content: string) {
  // ...existing sendMessage logic (guards, streaming, event loop)...

  // After the for-await loop completes:
  const lastEvent = currentMsg.events?.at(-1);
  const count = get()._autoContinueCount;
  if (
    lastEvent?.type === 'error' &&
    lastEvent.message.toLowerCase().includes('max turn') &&
    count < 3
  ) {
    set({ _autoContinueCount: count + 1, error: null });
    set({ statusMessage: `Continuing analysis (${count + 1}/3)...` });
    await get()._sendMessageInternal('Continue');
    return;
  }
}
```

**Safety cap**: Maximum 3 auto-continues per user-initiated message. The counter is a store field so it survives across the recursive `_sendMessageInternal` calls. It resets when the user sends a new message via the public `sendMessage()`.

**UI indication**: When auto-continuing, set `statusMessage: "Continuing analysis (N/3)..."` so the user sees progress.

## §10 — TODO in v2 Design Doc

Add to the "Deferred Decisions" section of `docs/archcanvas-v2-design.md`:

> **Node/Tauri `getPath()` auto-resolve**: `FileSystem.getPath()` is defined on the interface and implemented for `NodeFileSystem` and `TauriFileSystem`, but not exercised in the current web-only runtime. When the app runs natively (Tauri desktop, CLI with Node), `openProject()` should auto-set `projectPath` from `fs.getPath()`, eliminating the manual path input requirement. Target: I7 (Packaging & Polish).

## §11 — Chat Path Guard for Non-Onboarding Chat

The hard guard in `sendMessage()` covers both onboarding init and regular chat. For regular chat (user opens chat panel after project is loaded):

- **Node/Tauri**: `projectPath` is auto-set by `openProject()` → chat works immediately
- **Web**: `projectPath` is `null` after `openProject()` → user sees error "Project path is required for AI chat"

For the web case in regular (non-onboarding) chat, the user needs a way to set the path outside the wizard. Options:
1. A settings panel with a "Project Path" field
2. An inline prompt in the chat panel when path is missing

**For this round**: show the error message in the chat panel. The user can set the path via the onboarding wizard's AI flow. A dedicated settings panel is deferred to I7.

**However**: if the user chose "Blank Canvas" (skipping the wizard), they have no way to set the path except by re-doing the wizard. To handle this:

**Inline path input in ChatPanel**: When `projectPath` is null and the user has an active provider, `ChatPanel` renders a path input bar above the message input instead of the error text. This is a single-line text input with a "Set" button:

```
┌──────────────────────────────────────────┐
│ Project path: [/path/to/project   ] [Set]│
│ ⚠ Required for AI chat                  │
├──────────────────────────────────────────┤
│ (chat messages area — empty)             │
│                                          │
├──────────────────────────────────────────┤
│ [Type a message...              ] [Send] │
└──────────────────────────────────────────┘
```

- The "Set" button calls `useFileStore.getState().setProjectPath(value)` and the input bar disappears
- The message input is disabled while the path bar is showing
- No separate modal component needed — it's a conditional render within `ChatPanel`
- Placeholder: `"/Users/you/projects/my-app"`
- Validates non-empty on submit (no filesystem validation — the path is trusted)

## Testing

### Unit Tests

1. **`FileSystem.getPath()`**: Each implementation returns the expected value (Node → path, Tauri → path, Web → null, InMemory → null)
2. **`fileStore.projectPath`**: Auto-set from `fs.getPath()` when non-null, preserved when `getPath()` is null, manual set via `setProjectPath()`
3. **`fileStore.projectPath` sequencing**: `completeOnboarding('ai', survey)` sets `projectPath` from survey AFTER `openProject` completes
4. **`chatStore.sendMessage()` hard guard**: Returns error when `projectPath` is null, proceeds when set
5. **`assembleContext()`**: Uses `fileStore.projectPath` instead of `'.'`
6. **`assembleInitPrompt`**: Includes project path in output (update existing tests for new `SurveyData.projectPath` field)
7. **`AiSurveyStep`**: Project path field present, required, pre-filled when available
8. **One project per tab**: `open()` and `newProject()` call `window.open()` when `fs !== null`
9. **Max-turns auto-continue**: Detects max-turn error, auto-sends "Continue", counter resets per user message, respects 3-retry cap via store field `_autoContinueCount`
10. **Bridge CWD**: `sendMessage` passes `context.projectPath` as `cwd` to SDK query
11. **ChatPanel path input**: Renders path input bar when `projectPath` is null, hides after setting

### E2E Tests

1. **ProjectGate auto-trigger**: `/?action=open` auto-triggers the picker (verify no crash; can't automate native picker)
2. **Chat path guard**: Open project → open chat → verify error about missing path
3. **Wizard path field**: Go through AI onboarding → verify path field is visible and required
