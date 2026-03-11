import { useCallback } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore, LEFT_PANEL_COLLAPSE_THRESHOLD } from '@/store/uiStore';
import { Toolbar } from '@/components/toolbar';
import { Canvas } from '@/components/canvas/Canvas';
import { NodeDetailPanel } from '@/components/panels/NodeDetailPanel';
import { EdgeDetailPanel } from '@/components/panels/EdgeDetailPanel';
import { TerminalPanel } from '@/components/panels/TerminalPanel';
import { NodeDefBrowser } from '@/components/panels/NodeDefBrowser';
import { DialogHost, getRegisteredDialogs } from '@/dialogs';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { QuickSearchOverlay } from '@/components/shared/QuickSearchOverlay';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { Toast } from '@/components/shared/Toast';
import { ResizeHandle } from '@/components/shared/ResizeHandle';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useIPadExternalKeyboard } from '@/hooks/useIPadExternalKeyboard';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAutoSaveOnBlur } from '@/hooks/useAutoSaveOnBlur';
import { useFilePolling } from '@/hooks/useFilePolling';
import {
  useViewportSize,
  ICON_RAIL_BREAKPOINT,
  MIN_VIABLE_WIDTH,
  MIN_VIABLE_HEIGHT,
} from '@/hooks/useViewportSize';
import { useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';
import { useAppUrlOpen } from '@/hooks/useAppUrlOpen';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import { FocusZoneProvider, FocusZoneRegion, FocusZone } from '@/core/input/focusZones';
import { ModeStatusBar } from '@/components/canvas/ModeStatusBar';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { CachedFilesIndicator } from '@/components/shared/CachedFilesIndicator';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';

export function App() {
  const nodeCount = useGraphStore((s) => s.nodeCount);
  const edgeCount = useGraphStore((s) => s.edgeCount);
  const isDirty = useGraphStore((s) => s.isDirty);

  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelTab = useUIStore((s) => s.rightPanelTab);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const leftPanelWidth = useUIStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setLeftPanelWidth = useUIStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const autosaveStatusMessage = useUIStore((s) => s.autosaveStatusMessage);
  const { syncStatus, pendingCount } = useBackgroundSync();
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  // Viewport size for responsive layout (iPad Split View / Slide Over)
  const { isCompact, isMinimal, width: viewportWidth } = useViewportSize();

  // Virtual keyboard detection for on-screen keyboard handling
  const { isKeyboardVisible, keyboardHeight } = useVirtualKeyboard();

  // Core initialization: engine init, splash screen, URL loading, panel responsiveness, auto-open panel
  const { initialized } = useAppInitialization(viewportWidth);

  const handleLeftResize = useCallback(
    (delta: number) => {
      const newWidth = leftPanelWidth + delta;
      // Snap-to-collapse: if dragged below collapse threshold, close the panel
      if (newWidth < LEFT_PANEL_COLLAPSE_THRESHOLD) {
        if (leftPanelOpen) {
          toggleLeftPanel();
        }
        return;
      }
      setLeftPanelWidth(newWidth);
    },
    [leftPanelWidth, setLeftPanelWidth, leftPanelOpen, toggleLeftPanel],
  );

  const handleRightResize = useCallback(
    (delta: number) => {
      setRightPanelWidth(rightPanelWidth + delta);
    },
    [rightPanelWidth, setRightPanelWidth],
  );

  // iPad external keyboard: capture-phase interception to suppress WKWebView defaults
  // Must be registered before useKeyboardShortcuts so capture fires first
  useIPadExternalKeyboard();

  // Global keyboard shortcuts (Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O, Ctrl+Z, Ctrl+Shift+Z)
  useKeyboardShortcuts();

  // Responsive layout: auto-close panels when window is narrow
  useResponsiveLayout();

  // Autosave when browser tab/window loses focus
  useAutoSaveOnBlur();

  // Poll open file for external modifications (every 1 second)
  useFilePolling();

  // Handle .archc file opens from iOS (Files app, AirDrop, etc.)
  useAppUrlOpen(initialized);

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <div className="text-[hsl(var(--muted-foreground))]">Initializing ArchCanvas...</div>
      </div>
    );
  }

  return (
    <FocusZoneProvider>
      <div
        className="h-screen w-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
        style={{ minWidth: MIN_VIABLE_WIDTH, minHeight: MIN_VIABLE_HEIGHT }}
      >
        {/* Offline Status Banner */}
        <OfflineBanner />

        {/* Toolbar - sticky at top */}
        <Toolbar />

        {/* Main content area: left panel, canvas, right panel */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Panel - NodeDef Browser (hidden in compact mode, icon-only rail <500px, draggable width otherwise) */}
          {!isCompact && leftPanelOpen ? (
            <>
              <FocusZoneRegion zone={FocusZone.LeftPanel}>
                <aside
                  className="overflow-y-auto shrink-0 bg-white border-r h-full safe-area-left"
                  style={{ width: viewportWidth < ICON_RAIL_BREAKPOINT ? 52 : leftPanelWidth }}
                  data-testid="left-panel"
                >
                  <NodeDefBrowser />
                </aside>
              </FocusZoneRegion>
              {/* Hide resize handle in icon-rail mode */}
              {viewportWidth >= ICON_RAIL_BREAKPOINT && (
                <ResizeHandle side="left" onResize={handleLeftResize} />
              )}
            </>
          ) : !isCompact ? (
            <button
              className="w-5 shrink-0 border-r bg-gray-50 hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors touch-target"
              onClick={toggleLeftPanel}
              title="Expand node types panel"
              data-testid="left-panel-expand"
              aria-label="Expand node types panel"
            >
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
          ) : null}

          {/* Center - Canvas (always gets minimum usable space) */}
          <FocusZoneRegion zone={FocusZone.Canvas} className="flex-1 min-w-[200px] relative">
            <Canvas />
          </FocusZoneRegion>

          {/* Right Panel - Side panel in regular/wide, bottom sheet overlay in compact */}
          {rightPanelOpen && !isCompact && (
            <>
              <ResizeHandle side="right" onResize={handleRightResize} />
              <FocusZoneRegion zone={FocusZone.RightPanel}>
                <aside
                  className={`shrink-0 bg-white border-l h-full safe-area-right ${rightPanelTab === 'terminal' ? 'overflow-hidden' : 'overflow-y-auto'}`}
                  style={{ width: rightPanelWidth }}
                  data-testid="right-panel"
                >
                  {rightPanelTab === 'terminal'
                    ? <TerminalPanel />
                    : selectedEdgeId ? <EdgeDetailPanel /> : <NodeDetailPanel />}
                </aside>
              </FocusZoneRegion>
            </>
          )}

          {/* Bottom sheet overlay for right panel in compact mode */}
          {rightPanelOpen && isCompact && (
            <div
              className="absolute left-0 right-0 z-50 bg-white border-t shadow-lg"
              style={{
                bottom: isKeyboardVisible ? `${keyboardHeight}px` : '0px',
                maxHeight: isKeyboardVisible ? `calc(50vh - ${keyboardHeight}px)` : '50vh',
                transition: 'bottom 0.2s ease-out, max-height 0.2s ease-out',
              }}
              data-testid="right-panel-sheet"
            >
              {/* Sheet handle + close button */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-gray-50">
                <div className="w-8 h-1 rounded-full bg-gray-300 mx-auto" />
                <button
                  type="button"
                  onClick={closeRightPanel}
                  className="absolute right-2 top-1.5 p-1 rounded hover:bg-gray-200 transition-colors touch-target"
                  aria-label="Close detail panel"
                  data-testid="right-panel-sheet-close"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <FocusZoneRegion zone={FocusZone.RightPanel}>
                <div
                  className={rightPanelTab === 'terminal' ? 'overflow-hidden' : 'overflow-y-auto'}
                  style={{
                    maxHeight: isKeyboardVisible
                      ? `calc(50vh - ${keyboardHeight}px - 36px)`
                      : 'calc(50vh - 36px)',
                  }}
                >
                  {rightPanelTab === 'terminal'
                    ? <TerminalPanel />
                    : selectedEdgeId ? <EdgeDetailPanel /> : <NodeDetailPanel />}
                </div>
              </FocusZoneRegion>
            </div>
          )}
        </div>

        {/* Registry-managed dialogs (delete, connection, unsaved, error, integrity, conflict, empty-project) */}
        <DialogHost />

        {/* Registered dialogs (self-registered via src/dialogs/) */}
        {getRegisteredDialogs().map((reg) => (
          <reg.component key={reg.id} />
        ))}

        {/* Command Palette (Cmd+K) */}
        <CommandPalette />

        {/* Quick Search (/) */}
        <QuickSearchOverlay />

        {/* Loading Overlay (file operations) */}
        <LoadingOverlay />

        {/* Toast notifications */}
        <Toast />

        {/* Status Bar - hidden in minimal Stage Manager windows to maximize canvas space */}
        <footer
          className="border-t flex items-center shrink-0 safe-area-bottom safe-area-left safe-area-right overflow-hidden bg-[hsl(var(--background)/0.85)] backdrop-blur-sm"
          data-testid="status-bar"
          style={{ height: 'clamp(1.5rem, 2vh, 2.25rem)', display: isMinimal ? 'none' : undefined }}
        >
          <div className="flex items-center px-2 text-xs text-[hsl(var(--muted-foreground))] flex-1 min-h-0 whitespace-nowrap gap-2">
            {/* Breadcrumb navigation (from ModeStatusBar) - flush left */}
            <ModeStatusBar />
            {/* Spacer pushes stats to the right */}
            <div className="flex-1" />
            {/* Essential: dirty indicator - always visible */}
            <span data-testid="dirty-indicator">{isDirty ? '● Modified' : '✓ Saved'}</span>
            {/* Non-essential items: hidden in compact mode via CSS */}
            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 self-center status-bar-compact-hide" />
            <span data-testid="node-count" className="status-bar-compact-hide">
              Nodes: {nodeCount}
            </span>
            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 self-center status-bar-compact-hide" />
            <span data-testid="edge-count" className="status-bar-compact-hide">
              Edges: {edgeCount}
            </span>
            {(selectedNodeIds.length > 1 || selectedEdgeIds.length > 1) && (
              <>
                <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 self-center" />
                <span data-testid="selection-count" className="text-blue-500 font-medium">
                  Selected:{' '}
                  {selectedNodeIds.length > 0
                    ? `${selectedNodeIds.length} node${selectedNodeIds.length !== 1 ? 's' : ''}`
                    : `${selectedEdgeIds.length} edge${selectedEdgeIds.length !== 1 ? 's' : ''}`}
                </span>
              </>
            )}
            {autosaveStatusMessage && (
              <>
                <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 self-center status-bar-compact-hide" />
                <span
                  data-testid="autosave-status"
                  className="text-green-600 status-bar-compact-hide"
                >
                  {autosaveStatusMessage}
                </span>
              </>
            )}
            <SyncStatusIndicator syncStatus={syncStatus} pendingCount={pendingCount} />
            <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 self-center status-bar-compact-hide" />
            <span data-testid="zoom-level" className="status-bar-compact-hide">
              Zoom: {Math.round(zoom * 100)}%
            </span>
            <span className="status-bar-compact-hide">
              <CachedFilesIndicator />
            </span>
          </div>
        </footer>
      </div>
    </FocusZoneProvider>
  );
}
