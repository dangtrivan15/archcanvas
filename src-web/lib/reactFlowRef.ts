import type { ReactFlowInstance } from '@xyflow/react';

let instance: ReactFlowInstance | null = null;

export function setReactFlowInstance(rf: ReactFlowInstance): void {
  instance = rf;
}

export function getReactFlowInstance(): ReactFlowInstance | null {
  return instance;
}
