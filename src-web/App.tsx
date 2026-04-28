import { enablePatches } from 'immer';
import { useEffect, useRef } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { ReactFlowProvider } from "@xyflow/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { TopMenubar } from "@/components/layout/TopMenubar";
import { LeftToolbar } from "@/components/layout/LeftToolbar";
import { RightPanel } from "@/components/layout/RightPanel";
import { StatusBar } from "@/components/layout/StatusBar";
import { ProjectGate } from "@/components/layout/ProjectGate";
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { Canvas } from "@/components/canvas/Canvas";
import { useAppKeyboard } from '@/components/hooks/useAppKeyboard';
import { useAiProvider } from '@/components/hooks/useAiProvider';
import { useRegistryStore } from '@/store/registryStore';
import { createNodeDefWatcher, type NodeDefWatcher } from '@/core/registry';
import { useFileStore } from '@/store/fileStore';
import { useUiStore, SIDEBAR_WIDTH_PRESETS, persistPanelLayout } from '@/store/uiStore';
import { AppearanceDialog } from '@/components/AppearanceDialog';
import { AiSettingsDialog } from '@/components/AiSettingsDialog';
import { TemplatePickerDialogWrapper } from '@/components/templates/TemplatePickerDialogWrapper';
import { ExportDialog } from '@/components/ExportDialog';
import { RegistryStatusDialog } from '@/components/RegistryStatusDialog';
import { InstallNodeDefDialog } from '@/components/InstallNodeDefDialog';
import { PublishNodeDefDialog } from '@/components/PublishNodeDefDialog';
import { useAuthStore } from '@/store/authStore';
import { checkForUpdate } from '@/core/updater';
import { focusCurrentWindow } from '@/core/focusWindow';
import '@/store/themeStore'; // side-effect: applies theme on import

enablePatches();

export function App() {
  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const rightPanelRef = useRef<PanelImperativeHandle>(null);

  // C10: App-level keyboard shortcuts (Cmd+S, Cmd+O, Cmd+Shift+S)
  useAppKeyboard();

  // I6a: Bootstrap AI chat WebSocket provider
  useAiProvider();

  // Project gate: check if a filesystem is bound
  const fs = useFileStore((s) => s.fs);
  const status = useFileStore((s) => s.status);

  // C8.2: Reactive document title — "● {name} — ArchCanvas" when dirty
  const projectName = useFileStore(
    (s) => s.project?.root.data.project?.name ?? null,
  );
  const dirtyCanvases = useFileStore((s) => s.dirtyCanvases);
  const isDirty = dirtyCanvases.size > 0;

  useEffect(() => {
    if (!projectName) {
      document.title = 'ArchCanvas';
    } else if (isDirty) {
      document.title = `\u25CF ${projectName} \u2014 ArchCanvas`;
    } else {
      document.title = `${projectName} \u2014 ArchCanvas`;
    }
  }, [projectName, isDirty]);

  // C9.7: beforeunload — trigger native browser dialog when dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useFileStore.getState().isDirty()) {
        e.preventDefault();
        e.returnValue = true;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    // Fast startup: builtins only (no fs needed)
    useRegistryStore.getState().initialize();

    let watcher: NodeDefWatcher | null = null;

    // When a project loads, re-initialize with project-local defs and start watcher
    const unsub = useFileStore.subscribe((state, prev) => {
      if (state.status === 'loaded' && state.fs && state.status !== prev.status) {
        const currentFs = state.fs;
        const projectRoot = state.projectPath ?? '';

        // Re-initialize registry with project-local defs
        useRegistryStore.getState().initialize(currentFs, projectRoot);

        // Start watching for changes
        watcher?.stop();
        watcher = createNodeDefWatcher(currentFs, projectRoot, () =>
          useRegistryStore.getState().reloadProjectLocal(currentFs, projectRoot),
        );
      }
    });

    return () => {
      unsub();
      watcher?.stop();
    };
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, []);

  // Safety-net: bring window to foreground on cold start (best-effort, fire-and-forget)
  useEffect(() => {
    focusCurrentWindow();
  }, []);

  // Hydrate auth state from localStorage on app start
  useEffect(() => {
    useAuthStore.getState()._hydrate();
  }, []);

  useEffect(() => {
    // Pass ref objects (not .current) so the store reads .current at call
    // time — the panel library sets .current asynchronously after mount.
    useUiStore.getState().setLeftPanelRef(leftPanelRef);
    useUiStore.getState().setRightPanelRef(rightPanelRef);

    // Restore persisted panel collapse states after a short delay
    // (panel refs need time to initialize their imperative handles)
    const timer = setTimeout(() => {
      const { leftPanelCollapsed, rightPanelCollapsed } = useUiStore.getState();
      if (leftPanelCollapsed) leftPanelRef.current?.collapse();
      if (rightPanelCollapsed) rightPanelRef.current?.collapse();
    }, 0);

    return () => {
      clearTimeout(timer);
      useUiStore.getState().setLeftPanelRef(null);
      useUiStore.getState().setRightPanelRef(null);
    };
  }, []);

  // Sidebar width preset — read from store for dynamic panel sizing
  const sidebarWidthPreset = useUiStore((s) => s.sidebarWidthPreset);
  const sidebarPresetConfig = SIDEBAR_WIDTH_PRESETS[sidebarWidthPreset];

  // Status bar visibility
  const showStatusBar = useUiStore((s) => s.showStatusBar);

  // If no filesystem is bound, show the project gate
  if (!fs) {
    return <ProjectGate />;
  }

  // If the project directory is empty, show the onboarding wizard
  if (status === 'needs_onboarding') {
    return <OnboardingWizard />;
  }

  // Error or loading with fs set (e.g., completeOnboarding → openProject failure)
  // — route back to ProjectGate which handles both states (error banner, loading text)
  if (status === 'error' || status === 'loading') {
    return <ProjectGate />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <ReactFlowProvider>
        <div className="flex h-screen flex-col">
          <TopMenubar />
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel
              panelRef={leftPanelRef}
              defaultSize="4%"
              minSize="48px"
              maxSize="12%"
              collapsible
              collapsedSize="0px"
              onResize={() => {
                const collapsed = leftPanelRef.current?.isCollapsed() ?? false;
                const prev = useUiStore.getState().leftPanelCollapsed;
                useUiStore.setState({ leftPanelCollapsed: collapsed });
                if (collapsed !== prev) {
                  persistPanelLayout({ leftCollapsed: collapsed });
                }
              }}
            >
              <LeftToolbar />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="74%">
              <Canvas />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              panelRef={rightPanelRef}
              defaultSize={sidebarPresetConfig.defaultSize}
              minSize={sidebarPresetConfig.minSize}
              maxSize="40%"
              collapsible
              collapsedSize="28px"
              onResize={() => {
                const collapsed = rightPanelRef.current?.isCollapsed() ?? false;
                const prev = useUiStore.getState().rightPanelCollapsed;
                useUiStore.setState({ rightPanelCollapsed: collapsed });
                if (collapsed !== prev) {
                  persistPanelLayout({ rightCollapsed: collapsed });
                }
              }}
            >
              <RightPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
          {showStatusBar && <StatusBar />}
          <AppearanceDialog />
          <AiSettingsDialog />
          <TemplatePickerDialogWrapper />
          <ExportDialog />
          <RegistryStatusDialog />
          <InstallNodeDefDialog />
          <PublishNodeDefDialog />
        </div>
      </ReactFlowProvider>
    </TooltipProvider>
  );
}
