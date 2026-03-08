/**
 * Analysis store — manages the state of the codebase analysis pipeline.
 *
 * Tracks progress, errors, and the abort controller for cancellation.
 * The AnalysisProgressDialog reads from this store, and the projectStore
 * triggers analysis by calling `startAnalysis()`.
 */

import { create } from 'zustand';
import type { AnalyzeProgress } from '@/analyze/browserPipeline';

export interface AnalysisStoreState {
  /** Whether the analysis dialog is open */
  dialogOpen: boolean;
  /** Current progress state */
  progress: AnalyzeProgress | null;
  /** Error message if pipeline failed */
  error: string | null;
  /** Whether analysis is currently running */
  isRunning: boolean;
  /** AbortController for cancelling the pipeline */
  abortController: AbortController | null;

  // ── Actions ──
  /** Open the dialog and start tracking */
  openDialog: () => AbortController;
  /** Update progress */
  setProgress: (progress: AnalyzeProgress) => void;
  /** Set error state */
  setError: (error: string) => void;
  /** Mark as complete */
  markComplete: () => void;
  /** Cancel the running analysis */
  cancel: () => void;
  /** Close the dialog and reset state */
  closeDialog: () => void;
}

export const useAnalysisStore = create<AnalysisStoreState>((set, get) => ({
  dialogOpen: false,
  progress: null,
  error: null,
  isRunning: false,
  abortController: null,

  openDialog: () => {
    const controller = new AbortController();
    set({
      dialogOpen: true,
      progress: null,
      error: null,
      isRunning: true,
      abortController: controller,
    });
    return controller;
  },

  setProgress: (progress) => {
    set({ progress });
  },

  setError: (error) => {
    set({ error, isRunning: false });
  },

  markComplete: () => {
    set({ isRunning: false });
  },

  cancel: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      isRunning: false,
      error: 'Analysis cancelled by user',
    });
  },

  closeDialog: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort(); // Clean up if still running
    }
    set({
      dialogOpen: false,
      progress: null,
      error: null,
      isRunning: false,
      abortController: null,
    });
  },
}));
