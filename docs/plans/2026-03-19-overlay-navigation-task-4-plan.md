# Overlay Navigation — Task 4: Clean Deletion Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the three replaced viewport-zoom utilities and their tests, plus the prototype, with zero remaining references.

**Architecture:** Grep → verify zero source references → delete → verify build.

**Tech Stack:** Git, grep, TypeScript

---

### Task 4.1: Verify zero remaining source references

- [ ] **Step 1: Grep for all exported symbols from deleted files**

Run each command and verify zero matches in `src/` and `test/`:

```bash
grep -r "animateViewport" src/ test/ --include='*.ts' --include='*.tsx' -l
grep -r "computeZoomToRect" src/ test/ --include='*.ts' --include='*.tsx' -l
grep -r "computeMatchedViewport" src/ test/ --include='*.ts' --include='*.tsx' -l
grep -r "CONTAINER_HEADER_H\|CONTAINER_PAD_X\|CONTAINER_PAD_Y" src/ test/ --include='*.ts' --include='*.tsx' -l
```

Expected: Each grep returns only the source file itself and its test file — no other files. These are the files being deleted, so their self-references are expected. If any file OUTSIDE the deletion set appears in the results (e.g., a component or hook still importing one of these symbols), STOP and update that file before proceeding with deletion.

### Task 4.2: Delete files

- [ ] **Step 2: Delete source files**

```bash
rm src/lib/animateViewport.ts
rm src/lib/computeZoomToRect.ts
rm src/lib/computeMatchedViewport.ts
```

- [ ] **Step 3: Delete test files**

```bash
rm test/unit/lib/animateViewport.test.ts
rm test/unit/lib/computeZoomToRect.test.ts
rm test/unit/lib/computeMatchedViewport.test.ts
```

- [ ] **Step 4: Delete prototype**

```bash
rm prototype-nav-animation.html
```

### Task 4.3: Verify build and tests

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors (no remaining imports of deleted modules)

- [ ] **Step 6: Run unit tests**

Run: `npm run test:unit`
Expected: All tests PASS (deleted test files are no longer discovered)

- [ ] **Step 7: Run E2E tests**

Run: `npm run test:e2e`
Expected: All tests PASS

### Task 4.4: Final verification and commit

- [ ] **Step 8: Final grep to confirm zero traces**

```bash
grep -r "animateViewport\|computeZoomToRect\|computeMatchedViewport\|CONTAINER_HEADER_H\|CONTAINER_PAD_X\|CONTAINER_PAD_Y" src/ test/ --include='*.ts' --include='*.tsx'
```

Expected: Zero matches.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: delete replaced viewport-zoom utilities and prototype"
```
