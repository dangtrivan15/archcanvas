import { describe, it, expect } from 'vitest';
import { enablePatches } from 'immer';
import { addNode, updateNode } from '@/core/graph/engine';
import { makeCanvas, makeNode } from './helpers';

enablePatches();

describe('updateNode — color field', () => {
  it('sets a color on an inline node', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'n1' })] });
    const result = updateNode(canvas, 'n1', { color: '#ff6b6b' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updated = result.data.nodes!.find((n) => n.id === 'n1')!;
    expect('color' in updated && updated.color).toBe('#ff6b6b');
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('clears a color by setting undefined', () => {
    const nodeWithColor = makeNode({ id: 'n1', color: '#ff6b6b' });
    const canvas = makeCanvas({ nodes: [nodeWithColor] });
    const result = updateNode(canvas, 'n1', { color: undefined });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updated = result.data.nodes!.find((n) => n.id === 'n1')!;
    // Object.assign with { color: undefined } sets the key to undefined
    expect('color' in updated && updated.color).toBeUndefined();
  });

  it('preserves color through addNode', () => {
    const canvas = makeCanvas();
    const nodeWithColor = makeNode({ id: 'n1', color: '#22c55e' });
    const result = addNode(canvas, nodeWithColor);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const added = result.data.nodes!.find((n) => n.id === 'n1')!;
    expect('color' in added && added.color).toBe('#22c55e');
  });
});
