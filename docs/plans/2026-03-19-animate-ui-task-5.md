# Task 5: Onboarding & Dialogs

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Add animations to the onboarding wizard flow and the two app dialogs
**Parent feature:** [Animate UI Integration Index](./2026-03-19-animate-ui-integration-index.md)

## Write Set

- Modify: `src/components/onboarding/OnboardingWizard.tsx` (~27 → ~50 lines — step transition wrapper)
- Modify: `src/components/onboarding/InitMethodStep.tsx` (~61 → ~100 lines — card hover/entrance animations)
- Modify: `src/components/onboarding/AiSurveyStep.tsx` (~207 → ~250 lines — form section animations, animated checkbox)
- Modify: `src/components/AppearanceDialog.tsx` (~126 → ~160 lines — palette swatch animations, selection transition)
- Modify: `src/components/CreateSubsystemDialog.tsx` (~200 → ~230 lines — form field transitions, validation animation)

## Read Set (context needed)

- `src/components/onboarding/OnboardingWizard.tsx` — step routing (InitMethod → AiSurvey)
- `src/components/onboarding/InitMethodStep.tsx` — 2 large cards (AI Analyze, Blank Canvas) with emoji + descriptions
- `src/components/onboarding/AiSurveyStep.tsx` — survey form: description, projectPath, techStack checkboxes, depth radio, focusDirs
- `src/components/AppearanceDialog.tsx` — 3 sections: palette selection (3 palettes), theme mode (L/D/S), text size (S/M/L)
- `src/components/CreateSubsystemDialog.tsx` — form: name, auto-derived ID, auto-derived filename, error display
- `src/components/ui/dialog.tsx` — animated dialog from Task 2
- `src/components/ui/button.tsx` — animated button from Task 2
- `src/components/ui/checkbox.tsx` — animated checkbox from Task 3

## Dependencies

- **Blocked by:** Task 3 (needs animated Checkbox for AiSurveyStep tech stack toggles)
- **Blocks:** None

## Description

This task enhances the onboarding flow and dialog experiences. These are discrete, focused interactions where animation adds perceived quality — users form first impressions during onboarding, and dialogs are moments of focused attention.

### Per-component plan

**OnboardingWizard** — Step transition container.
- Wrap the step render in `AnimatePresence` with `mode="wait"`
- Step 1 → Step 2: current step slides out left, next step slides in from right
- Back navigation: reverse direction (slide out right, slide in from left)
- Use `key={currentStep}` to trigger transitions

**InitMethodStep** — The first thing users see.
- Title + subtitle: staggered fade-in (title first, subtitle 100ms later)
- Two option cards: entrance animation with slight stagger (card 1 at 200ms, card 2 at 350ms)
- Card hover: lift effect — `whileHover={{ y: -4, boxShadow: "0 8px 25px rgba(0,0,0,0.1)" }}`
- Card press: subtle scale-down `whileTap={{ scale: 0.98 }}`
- AI unavailable hint: subtle pulsing opacity if AI is not connected

**AiSurveyStep** — Form with multiple field types.
- Form sections: staggered fade-in on mount (each field group delays 50ms)
- Tech stack checkboxes: replace current toggle styling with animated Checkbox from Task 3
- Exploration depth radio: animated selection indicator (sliding pill or highlight)
- Back button: has left-arrow icon, should have hover translate-x effect
- Submit button: loading state with spinner animation when submitting
- Error/warning banners: `AnimatePresence` slide-down

**AppearanceDialog** — Theme settings.
- Dialog itself already animated from Task 2
- Palette swatches: hover scale effect on swatch circles
- Selected palette: animated checkmark appearance (scale-in with spring)
- Theme mode buttons: animated active indicator (sliding background, similar to toolbar from Task 4)
- Text size buttons: same sliding indicator pattern
- Section transitions: if future tabs are added, content area should use `AnimatePresence`

**CreateSubsystemDialog** — Creation form.
- Dialog already animated from Task 2
- Auto-derive fields (ID, filename): when they update based on name input, animate the text change (cross-fade or typewriter effect)
- Validation error: `AnimatePresence` for error message appearance (fade + slide-down)
- Create button: disabled → enabled state transition (opacity + slight scale)
- Success feedback: brief flash or check animation before dialog closes (optional)

### Acceptance criteria

- Onboarding step transitions are smooth and directional (forward/back)
- InitMethodStep cards have visible hover lift and entrance stagger
- AiSurveyStep uses animated checkboxes for tech stack
- AppearanceDialog palette selection animates
- CreateSubsystemDialog validation errors animate in/out
- `npm run build` and `npm run typecheck` pass
- Existing E2E tests for onboarding still pass
