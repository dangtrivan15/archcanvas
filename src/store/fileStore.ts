/**
 * File store - manages file operations (new, open, save, save as, load).
 *
 * Owns: fileName, fileHandle, fileCreatedAtMs, fileLastModifiedMs,
 *       fileExternallyModified, isSaving
 * Actions: newFile, openFile, saveFile, saveFileAs, loadFromUrl,
 *          loadFromDroppedFile, acknowledgeExternalModification
 */

import { create } from 'zustand';
import type { ArchGraph } from '@/types/graph';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { countAllNodes } from '@/core/graph/graphQuery';
import { getFileLastModified } from '@/core/platform/fileSystemAdapter';
import {
  decodeArchcData,
  deriveSummaryFileName,
  saveSummaryMarkdown,
  graphToProto,
} from '@/core/storage/fileIO';
import type { AIStateData } from '@/core/storage/fileIO';
import type { StorageHandle } from '@/core/storage/types';
import { enqueueSave } from '@/core/sync/syncQueue';
import { encode, CodecError, IntegrityError } from '@/core/storage/codec';
import { needsAutoLayout } from '@/core/layout/positionDetection';
import { useEngineStore } from './engineStore';
import { useGraphStore } from './graphStore';
import { useHistoryStore } from './historyStore';
import { useCanvasStore } from './canvasStore';
import { useUIStore } from './uiStore';
import { appEvents } from '@/events/appEvents';

export interface FileStoreState {
  /** Display name of the current file (shown in title bar) */
  fileName: string;
  /** Storage handle for save-in-place (wraps FileSystemFileHandle, File, or in-memory slot) */
  fileHandle: StorageHandle | null;
  /** File header timestamp (preserved across re-saves) */
  fileCreatedAtMs: number | null;
  /** Last-modified timestamp of the opened file (for external change detection) */
  fileLastModifiedMs: number | null;
  /** Flag: true when external modification has been detected by file polling */
  fileExternallyModified: boolean;
  /** Guard flag preventing concurrent saves */
  isSaving: boolean;

  // Actions
  acknowledgeExternalModification: () => void;
  newFile: () => void;
  openFile: () => Promise<boolean>;
  saveFile: () => Promise<boolean>;
  saveFileAs: () => Promise<boolean>;
  loadFromUrl: (url: string, fileName?: string) => Promise<boolean>;
  loadFromDroppedFile: (file: File) => Promise<boolean>;

  /** Internal: apply decoded file data to the store. */
  _applyDecodedFile: (
    graph: ArchGraph,
    fileName: string,
    fileHandle: StorageHandle | null,
    canvasState?: import('@/types/graph').SavedCanvasState,
    _aiState?: AIStateData,
    createdAtMs?: number,
  ) => void;
}

/**
 * Gather canvas state from external stores for saving.
 */
function _getCanvasStateForSave() {
  const canvasStoreState = useCanvasStore.getState();
  const uiStoreState = useUIStore.getState();

  return {
    viewport: canvasStoreState.viewport,
    selectedNodeIds: canvasStoreState.selectedNodeId ? [canvasStoreState.selectedNodeId] : [],
    navigationPath: [] as string[],
    panelLayout: {
      rightPanelOpen: uiStoreState.rightPanelOpen ?? false,
      rightPanelTab: (uiStoreState.rightPanelTab as string) ?? '',
      rightPanelWidth: uiStoreState.rightPanelWidth ?? 320,
    },
  };
}

/**
 * Lazy getter for the project store to avoid circular dependency.
 */
let _projectStoreRef: typeof import('./projectStore') | null = null;
let _projectStoreResolved = false;

function _getProjectStore() {
  if (!_projectStoreResolved) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _projectStoreRef = require('./projectStore');
    } catch {
      _projectStoreRef = null;
    }
    _projectStoreResolved = true;
  }
  return _projectStoreRef ? _projectStoreRef.useProjectStore : null;
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  fileName: 'Untitled Architecture',
  fileHandle: null,
  fileCreatedAtMs: null,
  fileLastModifiedMs: null,
  fileExternallyModified: false,
  isSaving: false,

  acknowledgeExternalModification: () => {
    set({ fileExternallyModified: false });
  },

  newFile: () => {
    const { textApi, undoManager } = useEngineStore.getState();
    if (!textApi || !undoManager) return;

    const graph = createEmptyGraph();
    textApi.setGraph(graph);
    useHistoryStore.getState().reset(graph);

    useGraphStore.setState({
      graph,
      isDirty: false,
      nodeCount: 0,
      edgeCount: 0,
    });

    set({
      fileName: 'Untitled Architecture',
      fileHandle: null,
      fileCreatedAtMs: null,
      fileLastModifiedMs: null,
      fileExternallyModified: false,
    });
  },

  _applyDecodedFile: (graph, fileName, fileHandle, canvasState, _aiState, createdAtMs) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.setGraph(graph);
    useHistoryStore.getState().reset(graph);

    useGraphStore.setState({
      graph,
      isDirty: false,
      nodeCount: countAllNodes(graph),
      edgeCount: graph.edges.length,
    });

    set({
      fileName,
      fileHandle,
      fileCreatedAtMs: createdAtMs ?? null,
      fileLastModifiedMs: null,
      fileExternallyModified: false,
    });

    // Capture the file's lastModified timestamp for external change polling
    getFileLastModified(fileHandle?._internal ?? null)
      .then((lastModified) => {
        if (lastModified !== null) {
          set({ fileLastModifiedMs: lastModified });
          console.log(`[FileStore] Captured file lastModified: ${lastModified}`);
        }
      })
      .catch((err) => {
        console.warn('[FileStore] Could not read file lastModified:', err);
      });

    if (canvasState) {
      useCanvasStore.getState().setViewport(canvasState.viewport);
      if (canvasState.panelLayout) {
        const uiActions = useUIStore.getState();
        if (canvasState.panelLayout.rightPanelOpen) {
          uiActions.openRightPanel();
        } else {
          uiActions.closeRightPanel();
        }
      }
    }

    // Request fit view so the canvas adjusts to show all nodes
    useCanvasStore.getState().requestFitView();

    console.log(
      `[FileStore] Opened file: ${fileName} (${countAllNodes(graph)} nodes, ${graph.edges.length} edges)`,
    );

    // Auto-layout if root nodes lack saved positions (all at 0,0)
    if (graph.nodes.length > 0 && needsAutoLayout(graph.nodes)) {
      console.log('[FileStore] Root nodes lack positions -- triggering auto-layout');
      setTimeout(() => {
        useGraphStore
          .getState()
          .autoLayout('horizontal', [])
          .then(() => {
            useCanvasStore.getState().requestFitView();
            console.log('[FileStore] Auto-layout on file open complete');
          })
          .catch((err) => {
            console.warn('[FileStore] Auto-layout on file open failed:', err);
          });
      }, 0);
    }
  },

  openFile: async () => {
    const { textApi, storageManager } = useEngineStore.getState();
    if (!textApi || !storageManager) return false;

    try {
      const openResult = await storageManager.openArchitecture();
      if (!openResult) return false;

      appEvents.emit('file:loading', { message: 'Opening file...' });

      const { result, handle } = openResult;
      get()._applyDecodedFile(
        result.graph,
        handle.name,
        handle,
        result.canvasState,
        result.aiState,
        result.createdAtMs,
      );
      appEvents.emit('file:loading-clear', {});
      return true;
    } catch (err) {
      appEvents.emit('file:loading-clear', {});

      if (err instanceof IntegrityError) {
        console.warn('[FileStore] File integrity check failed:', err.message);
        appEvents.emit('integrity-warning:show', {
          message:
            "The file's integrity checksum does not match its contents. " +
            'The file may have been corrupted or modified outside of ArchCanvas. ' +
            'Opening it anyway may result in unexpected behavior.',
          onProceed: async () => {
            try {
              appEvents.emit('file:loading', { message: 'Opening file...' });
              const retryResult = await storageManager.openArchitecture(
                undefined,
                { skipChecksumVerification: true },
              );
              if (!retryResult) return;
              const { result: r, handle: h } = retryResult;
              get()._applyDecodedFile(
                r.graph,
                h.name,
                h,
                r.canvasState,
                r.aiState,
                r.createdAtMs,
              );
              appEvents.emit('file:loading-clear', {});
              console.log(`[FileStore] Opened file with skipped checksum: ${h.name}`);
            } catch (retryErr) {
              appEvents.emit('file:loading-clear', {});
              console.error(
                '[FileStore] Failed to open file even with skipped checksum:',
                retryErr,
              );
              appEvents.emit('error:show', {
                title: 'Failed to Open File',
                message:
                  retryErr instanceof Error
                    ? retryErr.message
                    : 'Failed to decode the file contents.',
              });
            }
          },
        });
        return false;
      }

      console.error('[FileStore] Failed to open file:', err);

      if (err instanceof CodecError) {
        appEvents.emit('error:show', {
          title: 'Invalid File Format',
          message:
            err.message ||
            'The file could not be opened because it is not a valid ArchCanvas file or uses an unsupported format.',
        });
      } else {
        appEvents.emit('error:show', {
          title: 'Failed to Open File',
          message:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while opening the file.',
        });
      }

      return false;
    }
  },

  saveFile: async () => {
    if (get().isSaving) {
      console.log('[FileStore] Save already in progress, ignoring duplicate request');
      return false;
    }

    // If a project is open, delegate to project-level save
    const projectStore = _getProjectStore();
    if (projectStore) {
      const projectState = projectStore.getState();
      if (projectState.isProjectOpen && projectState.manifest?.rootFile) {
        set({ isSaving: true });
        appEvents.emit('file:loading', { message: 'Saving project...' });

        try {
          const { useNavigationStore } = await import('./navigationStore');
          const activeFilePath = useNavigationStore.getState().activeFilePath;

          const result = activeFilePath
            ? await projectState.saveChildArchc(activeFilePath)
            : await projectState.saveMainArchc();
          appEvents.emit('file:loading-clear', {});
          set({ isSaving: false });
          return result;
        } catch {
          appEvents.emit('file:loading-clear', {});
          set({ isSaving: false });
          return false;
        }
      }
    }

    const { graph, fileHandle, fileCreatedAtMs, fileName } = {
      ...get(),
      graph: useGraphStore.getState().graph,
    };
    const { exportApi, storageManager } = useEngineStore.getState();
    const graphAtSaveStart = graph;

    if (!fileHandle) {
      return get().saveFileAs();
    }

    if (!storageManager) {
      console.error('[FileStore] StorageManager not initialized');
      return false;
    }

    set({ isSaving: true });
    appEvents.emit('file:loading', { message: 'Saving file...' });

    try {
      const canvasState = _getCanvasStateForSave();
      const aiState = undefined;

      // If offline, queue the save for background sync
      if (!navigator.onLine) {
        try {
          const protoFile = graphToProto(
            graph,
            canvasState,
            undefined,
            aiState,
            fileCreatedAtMs ?? undefined,
          );
          const binaryData = await encode(protoFile);
          await enqueueSave(fileName, binaryData);
          appEvents.emit('file:loading-clear', {});
          set({ isSaving: false });
          appEvents.emit('toast:show', { message: 'Offline -- save queued for sync' });
          console.log('[FileStore] Save queued for background sync (offline)');
          return true;
        } catch (queueErr) {
          console.error('[FileStore] Failed to queue offline save:', queueErr);
        }
      }

      const updatedHandle = await storageManager.saveArchitecture(graph, fileHandle, {
        canvasState,
        aiState,
        createdAtMs: fileCreatedAtMs ?? undefined,
      });

      // Refresh lastModified timestamp after save so polling doesn't false-alarm
      const savedLastModified = await getFileLastModified(updatedHandle._internal);
      if (savedLastModified !== null) {
        set({ fileLastModifiedMs: savedLastModified });
      }

      // Update handle in case backend returned an updated one
      set({ fileHandle: updatedHandle });

      const graphChangedDuringSave = useGraphStore.getState().graph !== graphAtSaveStart;
      if (!fileCreatedAtMs) {
        useGraphStore.setState({ isDirty: graphChangedDuringSave });
        set({ fileCreatedAtMs: Date.now() });
      } else {
        useGraphStore.setState({ isDirty: graphChangedDuringSave });
      }

      // Auto-generate .summary.md sidecar file
      if (exportApi) {
        try {
          const summaryContent = exportApi.generateSummaryWithMermaid(graph);
          const summaryFileName = deriveSummaryFileName(fileName);
          await saveSummaryMarkdown(summaryContent, summaryFileName);
        } catch (summaryErr) {
          console.warn('[FileStore] Failed to generate summary sidecar:', summaryErr);
        }
      }

      appEvents.emit('file:loading-clear', {});
      set({ isSaving: false });

      if (!get().fileHandle) {
        appEvents.emit('toast:show', { message: "File downloaded to your browser's download folder" });
      } else {
        appEvents.emit('toast:show', { message: 'File saved' });
      }

      console.log('[FileStore] File saved successfully');
      return true;
    } catch (err) {
      appEvents.emit('file:loading-clear', {});
      set({ isSaving: false });
      console.error('[FileStore] Failed to save file:', err);
      appEvents.emit('error:show', {
        title: 'Save Failed',
        message:
          err instanceof Error
            ? `Could not save the file: ${err.message}`
            : 'An unexpected error occurred while saving the file. Please try again.',
      });
      return false;
    }
  },

  saveFileAs: async () => {
    if (get().isSaving) {
      console.log('[FileStore] Save already in progress, ignoring duplicate request');
      return false;
    }

    const graph = useGraphStore.getState().graph;
    const { fileName, fileCreatedAtMs } = get();
    const { exportApi, storageManager } = useEngineStore.getState();
    const graphAtSaveStart = graph;

    if (!storageManager) {
      console.error('[FileStore] StorageManager not initialized');
      return false;
    }

    set({ isSaving: true });

    try {
      const canvasState = _getCanvasStateForSave();
      const aiState = undefined;
      const result = await storageManager.saveArchitectureAs(graph, fileName, {
        canvasState,
        aiState,
        createdAtMs: fileCreatedAtMs ?? undefined,
      });
      if (!result) {
        set({ isSaving: false });
        return false;
      }

      appEvents.emit('file:loading', { message: 'Saving file...' });

      const graphChangedDuringSave = useGraphStore.getState().graph !== graphAtSaveStart;
      const newCreatedAtMs = fileCreatedAtMs ?? Date.now();

      const newLastModifiedMs = await getFileLastModified(result.handle._internal);

      useGraphStore.setState({ isDirty: graphChangedDuringSave });
      set({
        fileName: result.handle.name,
        fileHandle: result.handle,
        fileCreatedAtMs: newCreatedAtMs,
        fileLastModifiedMs: newLastModifiedMs,
      });

      // Auto-generate .summary.md sidecar file
      if (exportApi) {
        try {
          const summaryContent = exportApi.generateSummaryWithMermaid(graph);
          const summaryFileName = deriveSummaryFileName(result.handle.name);
          await saveSummaryMarkdown(summaryContent, summaryFileName);
        } catch (summaryErr) {
          console.warn('[FileStore] Failed to generate summary sidecar:', summaryErr);
        }
      }

      appEvents.emit('file:loading-clear', {});
      set({ isSaving: false });

      if (!result.handle._internal) {
        appEvents.emit('toast:show', {
          message: `"${result.handle.name}" downloaded to your browser's download folder`,
        });
      } else {
        appEvents.emit('toast:show', { message: `Saved as "${result.handle.name}"` });
      }

      console.log(`[FileStore] File saved as: ${result.handle.name}`);
      return true;
    } catch (err) {
      set({ isSaving: false });
      appEvents.emit('file:loading-clear', {});
      console.error('[FileStore] Failed to save file as:', err);
      appEvents.emit('error:show', {
        title: 'Save Failed',
        message:
          err instanceof Error
            ? `Could not save the file: ${err.message}`
            : 'An unexpected error occurred while saving the file. Please try again.',
      });
      return false;
    }
  },

  loadFromUrl: async (url, displayName) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return false;

    appEvents.emit('file:loading', { message: 'Loading file...' });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        appEvents.emit('file:loading-clear', {});
        console.error(`[FileStore] Failed to fetch file from ${url}: ${response.status}`);
        return false;
      }

      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);
      const fileName = displayName ?? url.split('/').pop() ?? 'Loaded File';

      try {
        const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data);
        get()._applyDecodedFile(graph, fileName, null, canvasState, aiState, createdAtMs);
        appEvents.emit('file:loading-clear', {});
        return true;
      } catch (decodeErr) {
        appEvents.emit('file:loading-clear', {});
        if (decodeErr instanceof IntegrityError) {
          console.warn('[FileStore] File integrity check failed:', decodeErr.message);
          appEvents.emit('integrity-warning:show', {
            message:
              "The file's integrity checksum does not match its contents. " +
              'The file may have been corrupted or modified outside of ArchCanvas. ' +
              'Opening it anyway may result in unexpected behavior.',
            onProceed: async () => {
              try {
                appEvents.emit('file:loading', { message: 'Loading file...' });
                const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data, {
                  skipChecksumVerification: true,
                });
                get()._applyDecodedFile(graph, fileName, null, canvasState, aiState, createdAtMs);
                appEvents.emit('file:loading-clear', {});
                console.log(`[FileStore] Loaded file from URL with skipped checksum: ${fileName}`);
              } catch (retryErr) {
                appEvents.emit('file:loading-clear', {});
                console.error(
                  '[FileStore] Failed to load file even with skipped checksum:',
                  retryErr,
                );
                appEvents.emit('error:show', {
                  title: 'Failed to Open File',
                  message:
                    retryErr instanceof Error
                      ? retryErr.message
                      : 'Failed to decode the file contents.',
                });
              }
            },
          });
          return false;
        }
        throw decodeErr;
      }
    } catch (err) {
      appEvents.emit('file:loading-clear', {});
      console.error('[FileStore] Failed to load file from URL:', err);

      if (err instanceof CodecError) {
        appEvents.emit('error:show', {
          title: 'Invalid File Format',
          message:
            err.message ||
            'The file could not be opened because it is not a valid ArchCanvas file or uses an unsupported format.',
        });
      } else {
        appEvents.emit('error:show', {
          title: 'Failed to Open File',
          message:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while opening the file.',
        });
      }

      return false;
    }
  },

  loadFromDroppedFile: async (file) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return false;

    if (!file.name.toLowerCase().endsWith('.archc')) {
      appEvents.emit('error:show', {
        title: 'Unsupported File Type',
        message: `"${file.name}" is not an ArchCanvas file. Only .archc files can be opened.`,
      });
      return false;
    }

    appEvents.emit('file:loading', { message: 'Opening dropped file...' });

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const fileName = file.name.replace(/\.archc$/i, '');

      try {
        const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data);
        get()._applyDecodedFile(graph, fileName, null, canvasState, aiState, createdAtMs);
        appEvents.emit('file:loading-clear', {});
        console.log(`[FileStore] Loaded dropped file: ${fileName}`);
        return true;
      } catch (decodeErr) {
        appEvents.emit('file:loading-clear', {});
        if (decodeErr instanceof IntegrityError) {
          console.warn('[FileStore] Dropped file integrity check failed:', decodeErr.message);
          appEvents.emit('integrity-warning:show', {
            message:
              "The dropped file's integrity checksum does not match its contents. " +
              'The file may have been corrupted or modified outside of ArchCanvas. ' +
              'Opening it anyway may result in unexpected behavior.',
            onProceed: async () => {
              try {
                appEvents.emit('file:loading', { message: 'Opening dropped file...' });
                const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data, {
                  skipChecksumVerification: true,
                });
                get()._applyDecodedFile(graph, fileName, null, canvasState, aiState, createdAtMs);
                appEvents.emit('file:loading-clear', {});
                console.log(`[FileStore] Loaded dropped file with skipped checksum: ${fileName}`);
              } catch (retryErr) {
                appEvents.emit('file:loading-clear', {});
                console.error(
                  '[FileStore] Failed to load dropped file even with skipped checksum:',
                  retryErr,
                );
                appEvents.emit('error:show', {
                  title: 'Failed to Open File',
                  message:
                    retryErr instanceof Error
                      ? retryErr.message
                      : 'Failed to decode the dropped file.',
                });
              }
            },
          });
          return false;
        }
        throw decodeErr;
      }
    } catch (err) {
      appEvents.emit('file:loading-clear', {});
      console.error('[FileStore] Failed to load dropped file:', err);

      if (err instanceof CodecError) {
        appEvents.emit('error:show', {
          title: 'Invalid File Format',
          message:
            err.message ||
            'The dropped file could not be opened because it is not a valid ArchCanvas file.',
        });
      } else {
        appEvents.emit('error:show', {
          title: 'Failed to Open File',
          message:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while opening the dropped file.',
        });
      }

      return false;
    }
  },
}));
