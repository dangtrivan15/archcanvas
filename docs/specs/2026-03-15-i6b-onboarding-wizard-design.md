# I6b: Onboarding Wizard — Design Spec

> **Date**: 2026-03-15 | **Status**: Approved
> **Scope**: Guided onboarding flow for new/empty projects with optional AI-powered architecture initialization
> **Parent spec**: `docs/archcanvas-v2-design.md` §8

---

## 1. Overview

The onboarding wizard is a full-screen guided flow that appears when a user opens or creates a project with no existing architecture. It replaces the current error state (red banner on empty `main.yaml`) with a clean two-path experience:

- **Blank Canvas** — 1 click, immediate canvas
- **AI Analyze** — survey questions → AI explores codebase → architecture builds in real-time on canvas

The wizard sits between `ProjectGate` (directory selection) and the canvas in the app's view hierarchy.

## 2. Entry Conditions

### Detection Logic

The detection lives inside `openProject(fs)` so that **both** `open()` and `newProject()` get the wizard path automatically — they both call `openProject()`.

`openProject(fs)` must check for empty-project state **before** calling `loadProject()`:

```typescript
openProject: async (fs) => {
  set({ status: 'loading', error: null });
  try {
    // 1. Check if .archcanvas/ exists
    const dirExists = await fs.exists('.archcanvas');
    if (!dirExists) {
      set({ fs, status: 'needs_onboarding', error: null });
      return;
    }

    // 2. Check if main.yaml exists
    const fileExists = await fs.exists('.archcanvas/main.yaml');
    if (!fileExists) {
      set({ fs, status: 'needs_onboarding', error: null });
      return;
    }

    // 3. Check if main.yaml has content
    const content = await fs.readFile('.archcanvas/main.yaml');
    if (content.trim() === '') {
      set({ fs, status: 'needs_onboarding', error: null });
      return;
    }

    // 4. Normal load path
    const project = await loadProject(fs);
    set({ project, fs, status: 'loaded', dirtyCanvases: new Set() });
  } catch (err) {
    set({
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
},
```

Key points:
- `fs` and `status` are set in the **same `set()` call** to avoid race conditions in React rendering
- The pre-checks happen before `loadProject()` / `parseCanvas()` — no reliance on catching parse errors
- `fs` is stored on `needs_onboarding` so the wizard can write files later

### Entry Condition Summary

| Condition | Detection | Result |
|-----------|-----------|--------|
| No `.archcanvas/` directory | `fs.exists('.archcanvas')` returns false | `{ fs, status: 'needs_onboarding' }` |
| `.archcanvas/` exists, no `main.yaml` | `fs.exists('.archcanvas/main.yaml')` returns false | `{ fs, status: 'needs_onboarding' }` |
| `main.yaml` is empty or whitespace-only | `content.trim() === ''` | `{ fs, status: 'needs_onboarding' }` |
| `main.yaml` has YAML content (even minimal) | Falls through to `loadProject()` | `{ fs, project, status: 'loaded' }` |
| `main.yaml` has corrupt/invalid YAML | `loadProject()` throws | `{ status: 'error' }` |

### New Store Status

Add `'needs_onboarding'` to `FileStoreState.status`:

```typescript
status: 'idle' | 'loading' | 'loaded' | 'needs_onboarding' | 'error';
```

### App Routing

```typescript
// App.tsx
if (!fs) return <ProjectGate />;
if (status === 'needs_onboarding') return <OnboardingWizard />;
// ... normal canvas layout
```

`OnboardingWizard` is only rendered when `fs` is set (guaranteed by the `!fs` guard above).

### Trigger from New Project

`fileStore.newProject()` currently scaffolds `.archcanvas/main.yaml` with a template and calls `openProject()`. Change it to:
1. Pick directory (via FilePicker)
2. Call `openProject(fs)` — which will detect no `.archcanvas/` and set `needs_onboarding`

`newProject()` no longer creates `.archcanvas/` or `main.yaml` — the wizard handles scaffolding on completion.

### Trigger from Open Project

`fileStore.open()` already calls `openProject(fs)`. With the detection logic inside `openProject()`, opening a bare directory now routes to the wizard instead of showing a red error banner. No changes needed to `open()` itself.

## 3. Wizard Flow

```
┌─────────────────────────────────────────────────┐
│                   Wizard                         │
│                                                  │
│  Project name: auto-set from directory basename  │
│  (not shown as a form field)                     │
│                                                  │
│  Step 1: How should we initialize?               │
│    ┌──────────────┐  ┌──────────────┐           │
│    │  🤖 AI       │  │  📋 Blank    │           │
│    │  Analyze     │  │  Canvas      │──→ DONE   │
│    └──────┬───────┘  └──────────────┘           │
│           │                                      │
│  Step 2: Help AI understand your project         │
│    • Description (free text)                     │
│    • Tech stack (optional preset chips)          │
│    • Exploration depth (dropdown)                │
│    • Focus directories (free text)               │
│    └──→ DONE                                     │
└─────────────────────────────────────────────────┘
```

### Project Name

Auto-inferred from the directory basename. The `FileSystem` interface needs a `getName(): string` method that returns the directory name. Implementations:
- `InMemoryFileSystem` — returns a configurable name (constructor parameter, defaults to `'untitled'`)
- `WebFileSystem` — returns `handle.name` from the `FileSystemDirectoryHandle`
- `NodeFileSystem` — returns `path.basename(rootPath)`
- `TauriFileSystem` — returns the last path segment

The wizard reads `useFileStore.getState().fs!.getName()` to get the project name.

### Step 1: "How should we initialize?"

Full-screen centered card (same visual language as `ProjectGate`).

Two clickable cards side by side:

**AI Analyze**
- Icon: robot/sparkle
- Title: "AI Analyze"
- Description: "Let AI scan your codebase and propose an architecture. You'll watch it build in real-time."
- Status hint: reads AI availability reactively from `useChatStore` — subscribes to `providers` map and checks the active provider's `available` property. Shows "Requires AI connection" in muted text when unavailable.
- Click action: advance to Step 2

**Blank Canvas**
- Icon: clipboard/grid
- Title: "Blank Canvas"
- Description: "Start with an empty canvas. Add nodes manually or ask AI later via the chat panel."
- Click action: calls `fileStore.completeOnboarding('blank')`
- Always available (no AI dependency)

**No "Next" button** — clicking a card IS the action.

### Step 2: "Help AI understand your project" (AI Analyze only)

Same centered card layout. Form fields:

| Field | Type | Required | Default | Purpose |
|-------|------|----------|---------|---------|
| Description | Textarea | Yes | — | "What is this project about?" — user's own words, fed into AI prompt |
| Tech stack | Chip selector | No | None | Preset options: TypeScript, JavaScript, Python, Go, Java, Rust, C#, Ruby, PHP, Swift, Kotlin. Multi-select. Joined by comma in prompt. |
| Exploration depth | Dropdown | No | "Full" | Options: "Full" (explore everything), "Top-level only" (high-level structure), "Custom" (shows numeric input for max depth) |
| Focus directories | Text input | No | — | Comma-separated paths relative to project root, e.g., `src/, services/`. Empty = explore everything. |

**Buttons:**
- "Back" — returns to Step 1
- "Start" — calls `fileStore.completeOnboarding('ai', surveyData)`. Disabled when AI provider is not available.

## 4. Completion Actions

All completion logic lives in a new **`fileStore.completeOnboarding()`** store action — the wizard component stays thin and doesn't touch file I/O directly (respects the layered architecture).

```typescript
interface SurveyData {
  description: string;
  techStack: string[];
  explorationDepth: 'full' | 'top-level' | 'custom';
  customDepth?: number;
  focusDirs: string;
}

completeOnboarding: async (
  type: 'blank' | 'ai',
  survey?: SurveyData,
) => Promise<void>
```

### Blank Canvas Path

`completeOnboarding('blank')`:

1. Create `.archcanvas/` directory via `fs.mkdir('.archcanvas')` (if not exists)
2. Write `.archcanvas/main.yaml`:
   ```yaml
   project:
     name: {directoryBasename}
     description: ""
     version: "1.0.0"
   nodes: []
   edges: []
   entities: []
   ```
3. Call `openProject(fs)` to load the project (this will succeed → `status: 'loaded'`)
4. Update `recentProjects` with the project name
5. Canvas appears with empty graph

### AI Analyze Path

`completeOnboarding('ai', surveyData)`:

1. Create `.archcanvas/` directory (if not exists)
2. Write `.archcanvas/main.yaml` with survey data:
   ```yaml
   project:
     name: {directoryBasename}
     description: "{survey.description}"
     version: "1.0.0"
   nodes: []
   edges: []
   entities: []
   ```
3. Call `openProject(fs)` to load the project
4. Update `recentProjects`
5. Canvas appears (empty initially)
6. Open chat panel: `useUiStore.getState().toggleChat()` (existing action — opens right panel in chat mode)
7. Wait for next tick (`setTimeout(..., 0)`) to ensure canvas is rendered and `assembleContext()` has valid `fileStore.project`
8. Assemble init prompt: `assembleInitPrompt(surveyData)` (pure function, see §5)
9. Send init message: `useChatStore.getState().sendMessage(prompt)`
   - If `activeProviderId` is null or provider is unavailable, `sendMessage` sets `error: 'No active AI provider'` — the user sees the error banner in the chat panel and can retry manually once connected. This is acceptable degradation.

### Recents Update

`recentProjects` is updated in `completeOnboarding()` after `openProject()` succeeds (i.e., after `status === 'loaded'`), using the directory basename as both `name` and `path`. This ensures recents are only updated for successfully loaded projects.

## 5. AI Init Prompt

Assembled from Step 2 survey inputs. Sent as the first user message in the chat panel (not a system prompt modification).

### Prompt Template

```
I'd like you to analyze this codebase and create an architecture diagram using ArchCanvas.

Project: {name}
Description: {description}
Tech stack: {techStack.join(', ') || "not specified"}

Exploration instructions:
- Depth: {depth === "full" ? "Explore the entire project recursively" : depth === "top-level" ? "Focus on the top-level structure, don't dive into implementation details" : "Explore up to " + customDepth + " levels deep"}
- Focus: {focusDirs ? "Focus your exploration on: " + focusDirs : "Explore the entire project directory"}

Please:
1. Explore the project structure and key configuration files
2. Identify major services, components, and infrastructure
3. Create nodes for each component using `archcanvas add-node`
4. Create edges showing how components communicate using `archcanvas add-edge`
5. Use subsystems (nested canvases) for complex components
6. Define entities for data flowing between components
7. Add meaningful edge labels and protocols (HTTP, gRPC, SQL, etc.)
8. Add notes for architectural decisions you observe

Use the built-in node types (compute/service, data/database, messaging/message-queue, etc.). Run `archcanvas catalog --json` to see all available types.
```

### Prompt Assembly

The prompt is assembled in a pure function (`src/core/ai/initPrompt.ts`) that takes the survey inputs and returns a string. This keeps it testable and separate from UI concerns.

```typescript
// src/core/ai/initPrompt.ts
export function assembleInitPrompt(
  projectName: string,
  survey: SurveyData,
): string { ... }
```

## 6. Component Structure

### New Files

```
src/components/onboarding/
  OnboardingWizard.tsx     — top-level wizard component (step routing)
  InitMethodStep.tsx       — Step 1: AI Analyze vs Blank Canvas cards
  AiSurveyStep.tsx         — Step 2: description, tech stack, depth, focus dirs
src/core/ai/
  initPrompt.ts            — pure function: survey inputs → prompt string
```

### Modified Files

```
src/store/fileStore.ts     — add 'needs_onboarding' status, modify openProject, add completeOnboarding
src/platform/fileSystem.ts — add getName(): string to FileSystem interface
src/platform/inMemoryFileSystem.ts — implement getName()
src/platform/webFileSystem.ts      — implement getName() via handle.name
src/platform/nodeFileSystem.ts     — implement getName() via path.basename
src/platform/tauriFileSystem.ts    — implement getName()
src/App.tsx                — route to OnboardingWizard when needs_onboarding
```

Note: `fileStore.newProject()` is simplified (no longer scaffolds files), and `open()` requires no changes — the detection logic in `openProject()` handles both paths.

## 7. Edge Cases

| Scenario | Behavior |
|----------|----------|
| User clicks "AI Analyze" but no AI connected | Card is clickable. Step 2 shows a banner: "AI is not connected." Step 2 "Start" button disabled until provider is available. |
| AI provider connects after wizard loads | Step 1 card updates reactively (removes "Requires AI connection" hint). Step 2 "Start" button becomes enabled. |
| User clicks "Back" from Step 2 | Returns to Step 1 (method selection) |
| `.archcanvas/main.yaml` is empty or whitespace-only | `openProject` pre-check: `content.trim() === ''` → `needs_onboarding` |
| `.archcanvas/main.yaml` has valid YAML but no `project` key | Loads normally — all `Canvas` schema fields are optional. User gets canvas with no project metadata. Not an onboarding case. |
| `.archcanvas/main.yaml` has corrupt/invalid YAML | `loadProject()` throws → `status: 'error'` (existing error handling, not wizard) |
| User opens a project that already has architecture | Normal load, no wizard (existing behavior) |
| AI init fails mid-way | Chat panel shows error (existing error handling). Partial architecture remains on canvas. User can continue manually or retry via chat. |
| User closes the app during wizard | No `main.yaml` written yet. Next open triggers wizard again (idempotent). |
| `sendMessage` called but no active provider | `chatStore.sendMessage` sets `error: 'No active AI provider'`. User sees error in chat panel, can retry once connected. |
| `saveAll` triggered during wizard (e.g., keyboard shortcut) | `dirtyCanvases` is empty → no-op. Safe. |

## 8. Testing Strategy

### Unit Tests
- `initPrompt.ts` — prompt assembly with various survey input combinations (all fields, minimal fields, multi-select tech stack)
- `fileStore.openProject` — `needs_onboarding` detection: no `.archcanvas/`, no `main.yaml`, empty `main.yaml`, whitespace-only `main.yaml`, valid `main.yaml`
- `fileStore.completeOnboarding` — blank path writes `main.yaml` and loads; AI path writes, loads, and sends chat message
- `FileSystem.getName()` — each implementation returns correct basename
- `OnboardingWizard` — step navigation, AI availability reactivity

### E2E Tests
- Blank canvas path: open empty dir → wizard appears → click Blank Canvas → canvas loads
- AI analyze path: wizard → AI Analyze → fill survey → verify prompt sent to chat
- Back navigation: Step 2 → Back → Step 1
- Existing project: open populated project → no wizard shown

## 9. Out of Scope

- **Templates** (Option C from original spec §8) — deferred to v2
- **AI bridge in production builds** — documented gap in `docs/archcanvas-v2-design.md` §10 ("Critical Gap: AI Bridge in Production Builds"), deferred to I7
- **Tech stack auto-detection** from `package.json` / `go.mod` — the AI handles this during exploration
- **Project name editing** — auto-inferred from directory basename, not user-facing
