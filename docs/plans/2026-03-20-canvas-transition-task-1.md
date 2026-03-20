# Task 1: canvasHostManager — DOM Registry

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the plain TS module that manages two registries: detached container divs and RefNodeSlot refs.

**Files:**
- Create: `src/core/canvas/canvasHostManager.ts`
- Create: `test/unit/core/canvas/canvasHostManager.test.ts`

**Spec reference:** "canvasHostManager.ts" in Architecture > Component Split and Slot-Ref Registry sections.

---

### Step 1: Write failing tests for the container registry

- [ ] Create `test/unit/core/canvas/canvasHostManager.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { canvasHostManager } from '@/core/canvas/canvasHostManager';

describe('canvasHostManager', () => {
  beforeEach(() => {
    canvasHostManager.clear(); // reset between tests
  });

  describe('container registry', () => {
    it('registers and retrieves a container', () => {
      const div = document.createElement('div');
      canvasHostManager.register('canvas-1', div);
      expect(canvasHostManager.getContainer('canvas-1')).toBe(div);
    });

    it('returns undefined for unregistered canvas', () => {
      expect(canvasHostManager.getContainer('nope')).toBeUndefined();
    });

    it('unregisters a container', () => {
      const div = document.createElement('div');
      canvasHostManager.register('canvas-1', div);
      canvasHostManager.unregister('canvas-1');
      expect(canvasHostManager.getContainer('canvas-1')).toBeUndefined();
    });
  });
});
```

- [ ] Run: `npm run test:unit -- --run test/unit/core/canvas/canvasHostManager.test.ts`
- [ ] Expected: FAIL — module not found

### Step 2: Implement container registry

- [ ] Create `src/core/canvas/canvasHostManager.ts`:

```typescript
const containers = new Map<string, HTMLDivElement>();
const slots = new Map<string, HTMLDivElement>();

export const canvasHostManager = {
  // Container registry (detached divs)
  register(canvasId: string, div: HTMLDivElement) {
    containers.set(canvasId, div);
  },
  unregister(canvasId: string) {
    containers.delete(canvasId);
  },
  getContainer(canvasId: string): HTMLDivElement | undefined {
    return containers.get(canvasId);
  },

  // Slot registry (RefNodeSlot refs)
  registerSlot(canvasId: string, el: HTMLDivElement) {
    slots.set(canvasId, el);
  },
  unregisterSlot(canvasId: string) {
    slots.delete(canvasId);
  },
  getSlot(canvasId: string): HTMLDivElement | undefined {
    return slots.get(canvasId);
  },

  // DOM reparenting
  attachToSlot(canvasId: string, slot: HTMLDivElement) {
    const container = containers.get(canvasId);
    if (container) {
      slot.appendChild(container);
    }
  },

  // Test helper
  clear() {
    containers.clear();
    slots.clear();
  },
};
```

- [ ] Run: `npm run test:unit -- --run test/unit/core/canvas/canvasHostManager.test.ts`
- [ ] Expected: PASS (3 tests)

### Step 3: Add slot registry and attachToSlot tests

- [ ] Add to the test file:

```typescript
  describe('slot registry', () => {
    it('registers and retrieves a slot', () => {
      const el = document.createElement('div');
      canvasHostManager.registerSlot('auth', el);
      expect(canvasHostManager.getSlot('auth')).toBe(el);
    });

    it('unregisters a slot', () => {
      const el = document.createElement('div');
      canvasHostManager.registerSlot('auth', el);
      canvasHostManager.unregisterSlot('auth');
      expect(canvasHostManager.getSlot('auth')).toBeUndefined();
    });
  });

  describe('attachToSlot', () => {
    it('appends container div to the slot element', () => {
      const container = document.createElement('div');
      container.textContent = 'canvas content';
      const slot = document.createElement('div');

      canvasHostManager.register('canvas-1', container);
      canvasHostManager.attachToSlot('canvas-1', slot);

      expect(slot.contains(container)).toBe(true);
      expect(slot.firstChild).toBe(container);
    });

    it('does nothing if container not registered', () => {
      const slot = document.createElement('div');
      canvasHostManager.attachToSlot('nope', slot);
      expect(slot.childNodes.length).toBe(0);
    });

    it('moves container between slots (appendChild moves, not copies)', () => {
      const container = document.createElement('div');
      const slotA = document.createElement('div');
      const slotB = document.createElement('div');

      canvasHostManager.register('c1', container);
      canvasHostManager.attachToSlot('c1', slotA);
      expect(slotA.contains(container)).toBe(true);

      canvasHostManager.attachToSlot('c1', slotB);
      expect(slotB.contains(container)).toBe(true);
      expect(slotA.contains(container)).toBe(false);
    });
  });
```

- [ ] Run: `npm run test:unit -- --run test/unit/core/canvas/canvasHostManager.test.ts`
- [ ] Expected: PASS (8 tests)

### Step 4: Commit

- [ ] `git add src/core/canvas/canvasHostManager.ts test/unit/core/canvas/canvasHostManager.test.ts`
- [ ] `git commit -m "feat: add canvasHostManager DOM registry module"`
