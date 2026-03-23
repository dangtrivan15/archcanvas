import { create } from 'zustand';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'downloading'
  | 'ready-to-restart'
  | 'up-to-date'
  | 'error';

interface UpdaterState {
  status: UpdateStatus;
  version: string | null;
  error: string | null;
  setStatus: (status: UpdateStatus) => void;
  setUpdateAvailable: (version: string) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  status: 'idle',
  version: null,
  error: null,
  setStatus: (status) => set({ status }),
  setUpdateAvailable: (version) => set({ status: 'update-available', version }),
  setError: (message) => set({ status: 'error', error: message }),
  reset: () => set({ status: 'idle', version: null, error: null }),
}));
