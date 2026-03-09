# P10: Undo System Optimization

**Parallel safety**: FULLY INDEPENDENT. Touches only `src/core/history/undoManager.ts`.
No overlap with any other proposal.

---

## Problem

### Full Snapshots Per Undo Entry

`src/core/history/undoManager.ts` stores a complete protobuf-encoded copy of the
entire Architecture for every undo entry:

```typescript
// Each undo entry contains:
interface UndoEntry {
  description: string;
  timestamp_ms: number;
  architecture_snapshot: Uint8Array; // Full protobuf of entire Architecture
}
```

### Memory Impact

For an architecture with 100 nodes and 80 edges:
- Each snapshot ≈ 50-100 KB (protobuf encoded)
- 50 undo entries = 2.5 - 5 MB of undo history
- Very large architectures (500+ nodes) could reach 20+ MB

### No Compaction

Undo history grows without bound until `max_entries` is reached, then it
truncates (losing old history). No middle ground.

### Performance

Every mutation requires a full protobuf encode of the entire Architecture.
For frequent operations (dragging a node, typing in a field), this can
cause jank.

---

## Proposed Solution

### A. Structural Sharing with Immer (Short-Term, Recommended)

Use Immer to produce structural copies with minimal allocation:

```typescript
// Current: full clone every mutation
const snapshot = structuredClone(graph); // Deep copy everything

// With Immer: structural sharing
import { produce, enablePatches } from 'immer';
enablePatches();

const [nextGraph, patches, inversePatches] = produceWithPatches(graph, draft => {
  draft.nodes.push(newNode);
});

// patches = [{ op: 'add', path: ['nodes', 5], value: newNode }]
// inversePatches = [{ op: 'remove', path: ['nodes', 5] }]
```

**Why Immer patches:**
- Tiny memory footprint (store patches, not full snapshots)
- Inverse patches give perfect undo
- Structural sharing means unchanged parts share references
- Already used widely in React ecosystem

### B. Hybrid Undo Store

Keep periodic full snapshots + patches between them:

```typescript
// src/core/history/undoManager.ts — updated
interface UndoManagerState {
  // Periodic full snapshots (every N operations)
  checkpoints: Checkpoint[];

  // Patches between checkpoints
  patchGroups: PatchGroup[];

  // Configuration
  checkpointInterval: number;     // Full snapshot every N operations (default: 20)
  maxCheckpoints: number;         // Keep at most N checkpoints (default: 5)
  maxTotalPatches: number;        // Cap total patches (default: 200)
}

interface Checkpoint {
  index: number;
  graph: ArchGraph;              // Full graph state (structural sharing, not serialized)
  timestamp: number;
}

interface PatchGroup {
  index: number;
  description: string;
  patches: Patch[];              // Forward patches
  inversePatches: Patch[];       // Undo patches
  timestamp: number;
}
```

**Undo algorithm:**
```
To undo operation N:
  1. Find the PatchGroup at index N
  2. Apply inversePatches to current graph
  3. Return new graph state

To undo past a checkpoint boundary:
  1. Restore the checkpoint
  2. Apply patches forward to desired state
```

**Memory usage comparison:**
```
Old: 50 entries × 100 KB = 5 MB
New: 2 checkpoints × 100 KB + 50 patch groups × 1 KB = 250 KB
     ~20x reduction
```

### C. Debounced Snapshots for Frequent Operations

When the user is dragging a node or typing continuously, don't create an undo
entry for every pixel/keystroke:

```typescript
// src/core/history/undoManager.ts
class UndoManager {
  private pendingPatches: Patch[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Called on every graph change
  trackMutation(patches: Patch[], inversePatches: Patch[], description: string) {
    this.pendingPatches.push(...patches);

    // Debounce: batch rapid changes into one undo entry
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.commitPatchGroup(description);
    }, 300); // 300ms of inactivity = commit
  }

  // Force commit (e.g., before save)
  flush() {
    if (this.pendingPatches.length > 0) {
      this.commitPatchGroup('batch');
    }
  }
}
```

### D. Migration Path

1. Add Immer as a dependency (`npm install immer`)
2. Update graphStore (from P02) to use `produceWithPatches` for mutations
3. Update undoManager to use patches instead of full snapshots
4. Keep proto UndoHistory encoding for file persistence (serialize checkpoints only)
5. Drop the full-snapshot path

### E. Proto Compatibility

The `.archc` file currently stores undo history as full snapshots:
```protobuf
message UndoEntry {
  string description = 1;
  int64 timestamp_ms = 2;
  bytes architecture_snapshot = 3;
}
```

For file persistence:
- Only save the last few checkpoints (not patches)
- This means undo history is reduced when saving/loading, which is acceptable
- Alternative: add a `patches` field to UndoEntry for full persistence

---

## Files to Modify

| File | Action |
|------|--------|
| `src/core/history/undoManager.ts` | Rewrite with patch-based undo |
| `src/core/storage/fileIO.ts` | Update undo history serialization |
| `package.json` | Add `immer` dependency |

---

## Acceptance Criteria

1. Undo/redo works correctly for all operations (add/remove/update nodes and edges)
2. Memory usage for 50 undo steps is under 500 KB (for a 100-node architecture)
3. Rapid operations (drag, type) are debounced into single undo entries
4. Undo history survives save/load (checkpoints preserved)
5. No perceptible lag when creating undo entries
6. `npm run test` passes
7. `npm run build` succeeds
