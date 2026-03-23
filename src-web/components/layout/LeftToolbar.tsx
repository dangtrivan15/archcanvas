import { useState, useRef, useCallback, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MousePointer2,
  Hand,
  Square,
  Search,
  Undo2,
  Redo2,
  LayoutGrid,
  MessageSquare,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useHistoryStore } from "@/store/historyStore";
import { useToolStore } from "@/store/toolStore";
import type { ToolMode } from "@/store/toolStore";
import { useUiStore } from "@/store/uiStore";
import { useThemeStore } from "@/store/themeStore";
import { useThemeToggler } from "@/components/ui/theme-toggler";
import { NodeTypeOverlay } from "@/components/layout/NodeTypeOverlay";

export function LeftToolbar() {
  const activeMode = useToolStore((s) => s.mode);
  const rightPanelMode = useUiStore((s) => s.rightPanelMode);
  const themeMode = useThemeStore((s) => s.mode);
  const resolvedMode = useThemeStore((s) => s.getResolvedMode());
  const themeIcon = themeMode === 'system' ? Monitor : resolvedMode === 'dark' ? Moon : Sun;
  const themeLabel = themeMode === 'system' ? 'System (auto)' : themeMode === 'dark' ? 'Dark mode' : 'Light mode';
  const prefersReduced = useReducedMotion();
  const { toggleTheme } = useThemeToggler('ltr');

  // ---------------------------------------------------------------------------
  // Overlay hover/pin state
  // ---------------------------------------------------------------------------
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearHoverTimeout();
    setOverlayVisible(true);
  }, [clearHoverTimeout]);

  const handleMouseLeave = useCallback(() => {
    clearHoverTimeout();
    hoverTimeout.current = setTimeout(() => {
      if (!pinned) setOverlayVisible(false);
    }, 150);
  }, [clearHoverTimeout, pinned]);

  const handlePin = useCallback((value: boolean) => {
    setPinned(value);
    if (value) setOverlayVisible(true);
  }, []);

  const handleAddNodeClick = useCallback(() => {
    if (pinned) {
      setPinned(false);
      setOverlayVisible(false);
    } else {
      setPinned(true);
      setOverlayVisible(true);
    }
  }, [pinned]);

  // Close overlay on Escape
  useEffect(() => {
    if (!pinned) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPinned(false);
        setOverlayVisible(false);
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [pinned]);

  // Close overlay on click-outside
  useEffect(() => {
    if (!pinned) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-testid="node-type-overlay"]') &&
          !target.closest('[aria-label*="Add Node"]')) {
        setPinned(false);
        setOverlayVisible(false);
      }
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [pinned]);

  // ---------------------------------------------------------------------------
  // Tool definitions
  // ---------------------------------------------------------------------------
  const tools: Array<{
    icon: typeof MousePointer2;
    label: string;
    shortcut: string;
    mode?: ToolMode;
    active?: boolean;
    tooltipSide?: 'right' | 'top';
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }> = [
    {
      icon: MousePointer2,
      label: "Select",
      shortcut: "V",
      mode: 'select',
      onClick: () => useToolStore.getState().setMode('select'),
    },
    {
      icon: Hand,
      label: "Pan",
      shortcut: "H",
      mode: 'pan',
      onClick: () => useToolStore.getState().setMode('pan'),
    },
    {
      icon: Square,
      label: "Add Node",
      shortcut: "N",
      tooltipSide: 'top',
      onClick: handleAddNodeClick,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    {
      icon: Search,
      label: "Search",
      shortcut: "⌘K",
      onClick: () => window.dispatchEvent(new CustomEvent('archcanvas:open-palette')),
    },
    {
      icon: LayoutGrid,
      label: "Auto Layout",
      shortcut: "⌘⇧L",
      onClick: () => window.dispatchEvent(new CustomEvent('archcanvas:auto-layout')),
    },
    {
      icon: Undo2,
      label: "Undo",
      shortcut: "⌘Z",
      onClick: () => useHistoryStore.getState().undo(),
    },
    {
      icon: Redo2,
      label: "Redo",
      shortcut: "⇧⌘Z",
      onClick: () => useHistoryStore.getState().redo(),
    },
    {
      icon: MessageSquare,
      label: "AI Chat",
      shortcut: "⌘⇧I",
      active: rightPanelMode === 'chat',
      onClick: () => useUiStore.getState().toggleChat(),
    },
    {
      icon: themeIcon,
      label: themeLabel,
      shortcut: '',
      onClick: () => {
        const { mode } = useThemeStore.getState();
        const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
        toggleTheme(next);
      },
    },
  ];

  const toolbarRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={toolbarRef} className="relative h-full">
      <ScrollArea className="h-full">
        <div className="flex flex-col items-center gap-1 p-2">
          {tools.map(({ icon: Icon, label, shortcut, mode, active, tooltipSide, onClick, onMouseEnter, onMouseLeave }) => {
            const isActive = active || (mode && activeMode === mode);

            return (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <button
                    aria-label={shortcut ? `${label} (${shortcut})` : label}
                    data-active={isActive ? "true" : undefined}
                    className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={onClick}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                  >
                    {isActive && (
                      <motion.div
                        layoutId={prefersReduced ? undefined : "toolbar-indicator"}
                        className="absolute inset-0 rounded-md bg-accent"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4" style={isActive ? { color: 'var(--color-accent-foreground)' } : undefined} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side={tooltipSide ?? "right"}>
                  {shortcut ? `${label} (${shortcut})` : label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </ScrollArea>
      <NodeTypeOverlay
        visible={overlayVisible}
        pinned={pinned}
        anchorRef={toolbarRef}
        onPin={handlePin}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
