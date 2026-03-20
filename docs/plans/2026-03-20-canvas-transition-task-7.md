# Task 7: useCanvasNavigation — Animation Orchestration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite useCanvasNavigation to orchestrate the expanding-frame animation for dive-in/go-up, with crossfade fallback for breadcrumb jumps.

**Files:**
- Modify: `src/components/canvas/hooks/useCanvasNavigation.ts` — full rewrite

**Depends on:** Task 6 (CanvasShell integration)

**Spec reference:** "Animation — Primary: Expanding Frame (v6)" and "Animation — Fallback: Clip-Path + Scale (v4)" sections.

**Demo reference:** `.superpowers/brainstorm/13487-1773993504/animation-demo-v6.html` (primary), `animation-demo-v4.html` (fallback)

---

### Step 1: Implement reduced-motion (instant swap) first

Start with the non-animated path to verify reparenting works correctly before adding animation.

- [ ] Rewrite `src/components/canvas/hooks/useCanvasNavigation.ts`:

```typescript
import { useRef, useCallback } from 'react';
import { useReducedMotion } from 'motion/react';
import { useNavigationStore } from '@/store/navigationStore';
import { canvasHostManager } from '@/core/canvas/canvasHostManager';
import type { CanvasViewHandle } from '../CanvasView';

const ANIM_DURATION = 450;
const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

interface NavigationRefs {
  shellSlotRef: React.RefObject<HTMLDivElement | null>;
  focusedCanvasRef: React.RefObject<CanvasViewHandle | null>;
  expandFrameRef: React.RefObject<HTMLDivElement | null>;
}

export function useCanvasNavigation(refs: NavigationRefs) {
  const prefersReduced = useReducedMotion();
  const animatingRef = useRef(false);

  const diveIn = useCallback((refNodeId: string) => {
    if (animatingRef.current) return;

    if (prefersReduced) {
      // Instant swap — no animation
      useNavigationStore.getState().diveIn(refNodeId);
      // CanvasShell re-renders, CanvasHosts remount, attachToSlot runs in useEffect
      return;
    }

    // Animated path — implemented in Step 2
    animateDiveIn(refNodeId, refs, animatingRef);
  }, [prefersReduced, refs]);

  const goUp = useCallback(() => {
    if (animatingRef.current) return;
    const nav = useNavigationStore.getState();
    if (nav.breadcrumb.length <= 1) return;

    if (prefersReduced) {
      nav.goUp();
      return;
    }

    animateGoUp(refs, animatingRef);
  }, [prefersReduced, refs]);

  const goToBreadcrumb = useCallback((index: number) => {
    if (animatingRef.current) return;
    const nav = useNavigationStore.getState();
    if (index === nav.breadcrumb.length - 1) return;

    // Single level up — use spatial animation
    if (index === nav.breadcrumb.length - 2 && !prefersReduced) {
      animateGoUp(refs, animatingRef);
      return;
    }

    if (prefersReduced) {
      nav.goToBreadcrumb(index);
      return;
    }

    // Multi-level — crossfade
    animateCrossfade(index, refs, animatingRef);
  }, [prefersReduced, refs]);

  return { diveIn, goUp, goToBreadcrumb };
}
```

- [ ] Update CanvasShell to pass refs and use the new hook API.
- [ ] **Critical:** Update `useCanvasKeyboard.ts` — it currently calls `useNavigationStore.getState().goUp()` directly on Escape. Change it to accept an `onGoUp` callback (same pattern as `onOpenPalette` and `onAutoLayout`). CanvasShell passes `navigation.goUp` as the callback. This ensures Escape goes through the animation hook, not directly to the store.

```typescript
// In useCanvasKeyboard signature, add:
interface CanvasKeyboardOptions {
  onOpenPalette: (prefix?: string) => void;
  onAutoLayout: () => void;
  onGoUp: () => void; // ← NEW
}

// Replace the direct store call:
// BEFORE: useNavigationStore.getState().goUp();
// AFTER:  opts.onGoUp();
```

- [ ] Similarly, update Breadcrumb.tsx — it calls `useNavigationStore.getState().goToBreadcrumb(i)` directly. It needs to accept an `onNavigate` callback from CanvasShell that goes through the animation hook.
- [ ] Run: `npm run test:unit -- --run`
- [ ] Expected: PASS (reduced-motion path works, animated paths are stubs)

**Modified files for this step (not in spec — add to tracking):**
- `src/components/canvas/hooks/useCanvasKeyboard.ts` — accept `onGoUp` callback
- `src/components/shared/Breadcrumb.tsx` — accept `onNavigate` callback

### Step 2: Implement expanding-frame dive-in animation

- [ ] Add the `animateDiveIn` function:

```typescript
async function animateDiveIn(
  refNodeId: string,
  refs: NavigationRefs,
  animatingRef: React.MutableRefObject<boolean>,
) {
  animatingRef.current = true;
  const { shellSlotRef, expandFrameRef } = refs;
  const shell = shellSlotRef.current;
  const frame = expandFrameRef.current;
  if (!shell || !frame) { animatingRef.current = false; return; }

  // 1. Measure
  const slot = canvasHostManager.getSlot(refNodeId);
  const container = canvasHostManager.getContainer(refNodeId);
  if (!slot || !container) { animatingRef.current = false; return; }

  const slotRect = slot.getBoundingClientRect();
  const shellRect = shell.getBoundingClientRect();
  const startScale = Math.min(slotRect.width / shellRect.width, slotRect.height / shellRect.height);

  // 2. Setup: move container into frame
  const frameContent = frame.querySelector('.frame-content') as HTMLDivElement;
  container.style.position = 'absolute';
  container.style.width = shellRect.width + 'px';
  container.style.height = shellRect.height + 'px';
  container.style.top = '0';
  container.style.left = '0';
  frameContent.appendChild(container);

  // Frame matches RefNode
  frame.classList.remove('hidden');
  frame.style.transition = 'none';
  frame.style.top = (slotRect.top - shellRect.top) + 'px';
  frame.style.left = (slotRect.left - shellRect.left) + 'px';
  frame.style.width = slotRect.width + 'px';
  frame.style.height = slotRect.height + 'px';
  frame.style.borderRadius = '8px';
  frame.style.borderColor = 'var(--color-border, #4a4a4a)';

  frameContent.style.transition = 'none';
  frameContent.style.width = shellRect.width + 'px';
  frameContent.style.height = shellRect.height + 'px';
  frameContent.style.transform = 'scale(' + startScale + ')';

  slot.style.opacity = '0';

  void frame.offsetHeight; // force reflow

  // 3. Fade parent
  const parentContainer = canvasHostManager.getContainer(
    useNavigationStore.getState().currentCanvasId
  );
  if (parentContainer) {
    parentContainer.style.transition = 'opacity ' + (ANIM_DURATION * 0.6) + 'ms ease-out';
    parentContainer.style.opacity = '0';
    parentContainer.style.pointerEvents = 'none';
  }

  // 4. Update store
  useNavigationStore.getState().diveIn(refNodeId);

  // 5. Animate
  frame.style.transition = [
    'top', 'left', 'width', 'height', 'border-radius'
  ].map(p => p + ' ' + ANIM_DURATION + 'ms ' + EASING).join(', ')
    + ', border-color ' + (ANIM_DURATION * 0.4) + 'ms ease ' + (ANIM_DURATION * 0.6) + 'ms';

  frame.style.top = '0px';
  frame.style.left = '0px';
  frame.style.width = shellRect.width + 'px';
  frame.style.height = shellRect.height + 'px';
  frame.style.borderRadius = '0px';
  frame.style.borderColor = 'transparent';

  frameContent.style.transition = 'transform ' + ANIM_DURATION + 'ms ' + EASING;
  frameContent.style.transform = 'scale(1)';

  await waitForTransitionEnd(frame, ANIM_DURATION);

  // 6. Finalize
  container.style.position = '';
  container.style.width = '';
  container.style.height = '';
  container.style.top = '';
  container.style.left = '';

  if (shellSlotRef.current) {
    shellSlotRef.current.appendChild(container);
  }

  frame.classList.add('hidden');
  frame.style.transition = 'none';
  frameContent.style.transition = 'none';
  frameContent.style.transform = '';

  if (parentContainer) {
    parentContainer.style.transition = '';
    parentContainer.style.opacity = '';
    parentContainer.style.pointerEvents = '';
    parentContainer.style.display = 'none';
  }

  slot.style.opacity = '';

  refs.focusedCanvasRef.current?.fitView({ duration: 0 });
  animatingRef.current = false;
}

function waitForTransitionEnd(el: HTMLElement, maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, maxMs + 50); // safety fallback
    el.addEventListener('transitionend', function handler(e) {
      if (e.target === el) {
        clearTimeout(timeout);
        el.removeEventListener('transitionend', handler);
        resolve();
      }
    });
  });
}
```

- [ ] Test manually in the browser: open the app, double-click a RefNode. The SubCanvas should expand from the RefNode to fill the shell.

### Step 3: Implement go-up animation

- [ ] Add `animateGoUp` — exact reverse of dive-in. Follow the Go-Up Sequence from the spec. Key difference: un-hide parent first, wait 2 rAF cycles, fitView parent, then measure and animate.

### Step 4: Implement crossfade for breadcrumb jumps

- [ ] Add `animateCrossfade` — fade out current (opacity 0, 150ms), update store, fade in target (opacity 0→1, 150ms).

### Step 5: Verify with playwright-cli

- [ ] Use the `playwright-cli` skill to visually verify:
  - Dive-in animation: double-click RefNode → expanding frame
  - Go-up animation: Escape → collapsing frame
  - Breadcrumb jump: click root from depth 2
  - Reduced motion: verify instant swap (toggle in OS accessibility settings or use `prefers-reduced-motion` media query override)

### Step 6: If expanding frame has issues, switch to v4 fallback

- [ ] If ReactFlow's ResizeObserver causes jitter during the frame animation, replace `animateDiveIn`/`animateGoUp` with the clip-path + scale approach from `animation-demo-v4.html`. The architecture is unchanged — only the CSS properties animated differ.

### Step 7: Commit

- [ ] `git add src/components/canvas/hooks/useCanvasNavigation.ts`
- [ ] `git commit -m "feat: add expanding-frame animation for canvas navigation"`
