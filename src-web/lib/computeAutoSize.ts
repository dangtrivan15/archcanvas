import type { Canvas } from '@/types';
import { NODE_MIN_WIDTH_LG, NODE_MIN_WIDTH_SM } from './nodeTokens';

const MIN_WIDTH = NODE_MIN_WIDTH_LG;
const MIN_HEIGHT = NODE_MIN_WIDTH_SM;
const MAX_WIDTH = 400;
const MAX_HEIGHT = 300;

const NODE_WIDTH = 60;
const NODE_HEIGHT = 30;

const HEADER_HEIGHT = 32;
const MARGIN = 24;

export function computeAutoSize(
  canvas: Canvas | undefined,
): { width: number; height: number } {
  const nodes = canvas?.nodes ?? [];
  if (nodes.length === 0) {
    return { width: MIN_WIDTH, height: MIN_HEIGHT };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + NODE_WIDTH > maxX) maxX = x + NODE_WIDTH;
    if (y + NODE_HEIGHT > maxY) maxY = y + NODE_HEIGHT;
  }

  const contentWidth = maxX - minX + MARGIN * 2;
  const contentHeight = maxY - minY + MARGIN * 2 + HEADER_HEIGHT;

  return {
    width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, contentWidth)),
    height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, contentHeight)),
  };
}
