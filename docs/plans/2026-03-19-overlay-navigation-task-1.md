# Task 1: Animation Utility (TDD)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Pure animation utility — RAF loop driving clip-path + viewport
**Parent feature:** [./2026-03-19-overlay-navigation-index.md](2026-03-19-overlay-navigation-index.md)
**Spec:** [docs/specs/2026-03-19-overlay-navigation-design.md](../specs/2026-03-19-overlay-navigation-design.md#srclibanimateoverlaytransitionts-70-loc)

## Write Set

- Create: `src/lib/animateOverlayTransition.ts` (~70 lines)
- Create: `test/unit/lib/animateOverlayTransition.test.ts` (test, unlimited)

## Read Set (context needed)

- `src/lib/animateViewport.ts` — current RAF animation pattern (being replaced, use as reference for structure)
- `src/lib/computeFitViewport.ts` — viewport type shape (`{ zoom, offsetX, offsetY }`)
- `docs/specs/2026-03-19-overlay-navigation-design.md` — interface spec for `OverlayAnimationConfig`

## Dependencies

- **Blocked by:** none
- **Blocks:** Task 3 (overlay navigation system imports this utility)

## Description

Build the pure animation function `animateOverlayTransition` that drives both clip-path and viewport interpolation in a single RAF loop. This is the engine of the new navigation transition.

**Interface** (from spec):

```ts
interface Inset { top: number; right: number; bottom: number; left: number }
interface Viewport { x: number; y: number; zoom: number }

interface OverlayAnimationConfig {
  overlayEl: HTMLElement;
  reactFlow: { setViewport(vp: Viewport): void };
  startInset: Inset;
  endInset: Inset;
  startVp: Viewport;
  endVp: Viewport;
  startRadius?: number;  // default 8
  endRadius?: number;     // default 0
  duration: number;
  onComplete: () => void;
}

function animateOverlayTransition(config: OverlayAnimationConfig): () => void;
```

**Per-frame logic:**
1. Compute eased `t` (cubic ease-in-out: `t < 0.5 ? 4t³ : 1 - (-2t+2)³/2`)
2. Lerp each clip inset value + border-radius
3. Set `overlayEl.style.clipPath = inset(${top}px ${right}px ${bottom}px ${left}px round ${rad}px)`
4. Lerp viewport x, y linearly; zoom logarithmically (`start * (end/start)^t`)
5. Call `reactFlow.setViewport({ x, y, zoom })`

**Edge cases to test:**
- Same start/end zoom (avoid `0^t` or `NaN` from log interpolation)
- Zero duration (should call onComplete immediately, no RAF)
- Cancel mid-animation (returned function cancels RAF, onComplete never fires)
- Start and end insets identical (clip-path unchanged, only viewport animates)
- Export the `easeInOut` function (reused by dissolve transitions)

**Acceptance criteria:**
- All unit tests pass
- Function signature matches the spec interface
- Log zoom interpolation for perceptually smooth zoom transitions
- Cancel function works correctly (no dangling RAF callbacks)
