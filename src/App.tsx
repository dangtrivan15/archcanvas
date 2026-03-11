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

export function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <ReactFlowProvider>
        <div className="flex h-screen flex-col">
          <TopMenubar />
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel
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
