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
import { Canvas } from "@/components/canvas/Canvas";
import { useRegistryStore } from '@/store/registryStore';
import { useUiStore } from '@/store/uiStore';

enablePatches();

export function App() {
  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const rightPanelRef = useRef<PanelImperativeHandle>(null);

  useEffect(() => { useRegistryStore.getState().initialize(); }, []);

  useEffect(() => {
    useUiStore.getState().setLeftPanelRef(leftPanelRef.current);
    useUiStore.getState().setRightPanelRef(rightPanelRef.current);
    return () => {
      useUiStore.getState().setLeftPanelRef(null);
      useUiStore.getState().setRightPanelRef(null);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <ReactFlowProvider>
        <div className="flex h-screen flex-col">
          <TopMenubar />
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel
              panelRef={leftPanelRef}
              defaultSize={4}
              minSize={3}
              maxSize={12}
              collapsible
              collapsedSize={0}
            >
              <LeftToolbar />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={76}>
              <Canvas />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              panelRef={rightPanelRef}
              defaultSize={20}
              minSize={12}
              maxSize={40}
              collapsible
              collapsedSize={0}
            >
              <RightPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
          <StatusBar />
        </div>
      </ReactFlowProvider>
    </TooltipProvider>
  );
}
