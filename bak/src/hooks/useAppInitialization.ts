/**
 * useAppInitialization — Extracts initialization and lifecycle effects from App.tsx.
 *
 * Handles:
 * 1. Engine initialization on mount
 * 2. Splash screen hide after initialization
 * 3. URL file loading after initialization
 * 4. Panel width responsiveness to viewport changes
 * 5. Auto-open right panel on node/edge selection
 */

import { useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { useEngineStore } from '@/store/engineStore';
import { useFileStore } from '@/store/fileStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { initRegistryBridge } from '@/core/registry/registryStore';
import { restoreLastProject } from '@/core/project/projectPersistence';
import { scanProjectFolder } from '@/core/project/scanner';

interface AppInitResult {
  /** Whether the core engine has finished initializing */
  initialized: boolean;
}

export function useAppInitialization(viewportWidth: number): AppInitResult {
  const initialize = useEngineStore((s) => s.initialize);
  const initialized = useEngineStore((s) => s.initialized);
  const registry = useEngineStore((s) => s.registry);
  const loadFromUrl = useFileStore((s) => s.loadFromUrl);

  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);

  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const updateLeftPanelWidthFromViewport = useUIStore((s) => s.updateLeftPanelWidthFromViewport);
  const updateRightPanelWidthFromViewport = useUIStore((s) => s.updateRightPanelWidthFromViewport);

  // 1. Engine initialization on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 2. Hide native splash screen once the app is fully initialized and interactive.
  //    launchAutoHide is false in capacitor.config.ts so we control the timing here.
  useEffect(() => {
    if (initialized) {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {
        // Silently ignore — SplashScreen.hide() throws on web where there's no native splash
      });
    }
  }, [initialized]);

  // 3. Wire the reactive registry store bridge once the registry is initialized.
  useEffect(() => {
    if (initialized && registry) {
      initRegistryBridge(registry);
    }
  }, [initialized, registry]);

  // 4. Auto-load: URL parameter takes priority, then restore last project from IndexedDB
  useEffect(() => {
    if (!initialized) return;

    // URL param takes priority (for development/testing)
    const params = new URLSearchParams(window.location.search);
    const loadFile = params.get('load');
    if (loadFile) {
      loadFromUrl(`/${loadFile}`).then((success) => {
        if (success) {
          console.log(`[App] Auto-loaded file from URL param: ${loadFile}`);
        }
      });
      return;
    }

    // Try restoring the last-opened project directory
    restoreLastProject()
      .then(async (saved) => {
        if (!saved) return;

        console.log(`[App] Restoring project: ${saved.name}`);
        const result = await scanProjectFolder(saved.handle);

        useProjectStore.setState({
          manifest: result.manifest,
          directoryHandle: result.directoryHandle,
          archcanvasHandle: result.archcanvasHandle,
          manifestExisted: result.manifestExisted,
          loadedFiles: new Map(),
          isProjectOpen: true,
          isEmpty: result.isEmpty,
        });

        if (result.manifest.rootFile) {
          await useProjectStore.getState().loadMainArchc();
          console.log(`[App] Restored project: ${saved.name}`);
        }
      })
      .catch((err) => {
        console.warn('[App] Failed to restore last project:', err);
      });
  }, [initialized, loadFromUrl]);

  // 4. Update panel widths when viewport width changes (only if user hasn't customized)
  useEffect(() => {
    updateLeftPanelWidthFromViewport(viewportWidth);
    updateRightPanelWidthFromViewport(viewportWidth);
  }, [viewportWidth, updateLeftPanelWidthFromViewport, updateRightPanelWidthFromViewport]);

  // 5. Auto-open right panel when a node or edge is selected
  useEffect(() => {
    if (selectedNodeId || selectedEdgeId) {
      openRightPanel();
    }
  }, [selectedNodeId, selectedEdgeId, openRightPanel]);

  return { initialized };
}
