# 14: Onboarding Wizard (I6b)

> **Date**: 2026-03-15 | **Status**: Complete
> **Scope**: Guided onboarding flow for new/empty projects with optional AI-powered architecture initialization

## Recap

The onboarding wizard replaces the red error banner that appeared when users opened or created a project with no existing `.archcanvas/` directory. Instead of an opaque parse error, users now see a clean two-path wizard: **Blank Canvas** (1 click, immediate canvas) or **AI Analyze** (survey questions, then AI explores the codebase and builds architecture in real-time via the chat panel).

The implementation followed a 4-task sequential plan across all layers of the stack:

1. **Platform** (Task 1) added `getName(): string` to the `FileSystem` interface and all 4 implementations (InMemory, Web, Node, Tauri), enabling the wizard to auto-infer the project name from the directory basename.

2. **Store** (Task 2) was the core change: `openProject()` now pre-checks for empty-project conditions (no `.archcanvas/`, no `main.yaml`, empty `main.yaml`) before calling `loadProject()`, routing to a new `'needs_onboarding'` status instead of throwing. A new `completeOnboarding(type, survey?)` action handles scaffolding, loading, recents, and the AI chat initiation path. `newProject()` was simplified to just pick-directory + `openProject()` (no more inline scaffolding).

3. **Core + UI** (Task 3) created the `assembleInitPrompt` pure function (prompt template from spec) and three React components: `OnboardingWizard` (step routing), `InitMethodStep` (two clickable cards with reactive AI availability hint), and `AiSurveyStep` (description, tech stack chips, exploration depth, focus dirs).

4. **Integration** (Task 4) wired the wizard into `App.tsx` between the `ProjectGate` and canvas layout, added a `gotoEmptyProject` E2E helper, and added 5 E2E tests covering the full wizard flow.

A routing gap was also discovered and fixed during code review: when `fs !== null` but `status === 'error'`, App.tsx now routes to `ProjectGate` instead of falling through to the canvas layout with no project.

**Test counts**: 1049 unit/integration tests (up from 1003) + 64 E2E tests (up from 59). **What's next**: I7 (Packaging + Polish).

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Empty-project detection placement | Inside `openProject()` (pre-check before `loadProject`) | Catching parse errors from `loadProject` | Pre-checks are explicit, avoid relying on error types; both `open()` and `newProject()` get wizard routing automatically |
| AI Analyze card interactivity | Always clickable (hint only when unavailable) | Disabled card when no AI | Spec §7 explicitly says "Card is clickable"; the gate lives at Step 2's "Start" button, not Step 1 |
| `completeOnboarding` AI path imports | Dynamic `import()` for uiStore, chatStore, initPrompt | Static top-level imports | Avoids circular dependencies (fileStore ↔ chatStore) |
| `SurveyData` type location | Exported from `fileStore.ts` | Separate `types/onboarding.ts` | Co-locates with consumer (`completeOnboarding`); acceptable for now, can be extracted if more consumers appear |
| App.tsx error/loading guard | Explicit guard routing to `ProjectGate` | Letting canvas render with null project | `ProjectGate` already handles error banner and loading text; prevents rendering canvas in broken state |

## Retrospective

- **What went well** -- The subagent-driven development process worked smoothly for this 4-task sequential plan. The two-stage review (spec compliance then code quality) caught two genuine issues: a `newProject()` recents regression (Task 2) and an inverted card order + paraphrased descriptions (Task 3). Both were fixed before moving to the next task. The App.tsx routing gap (error + fs set) was caught by the code quality reviewer on Task 4 -- a pre-existing issue made more reachable by the new `completeOnboarding` path.

- **Lessons** -- (1) Spec reviewers should quote the spec text when checking UI copy -- the Task 3 implementer paraphrased the card descriptions instead of using exact spec strings, which the spec reviewer caught. (2) When simplifying existing methods (like `newProject`), check what behaviors are being removed, not just what's being added -- the recents update was silently dropped. (3) The `status` state machine in App.tsx should be treated as exhaustive -- every status value needs a defined route.
