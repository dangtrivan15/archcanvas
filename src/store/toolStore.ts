import { create } from 'zustand';

export type ToolMode = 'select' | 'pan' | 'connect';

interface ToolState {
  mode: ToolMode;
  setMode: (mode: ToolMode) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  mode: 'select',
  setMode: (mode) => set({ mode }),
}));
