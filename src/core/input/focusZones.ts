/**
 * Focus Zone system for ArchCanvas.
 *
 * Tracks which area of the app has keyboard focus so that shortcuts
 * can behave differently based on context. For example, Delete on the
 * canvas deletes a node, but Delete in a text field deletes text.
 *
 * Provides:
 * - FocusZone enum (Canvas, LeftPanel, RightPanel, Dialog, CommandPalette, TextInput)
 * - FocusZoneContext + FocusZoneProvider wrapping the app
 * - useFocusZone() hook for consuming the active zone
 * - <FocusZoneRegion> component for auto-registering zones on focus/blur
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── FocusZone Enum ───────────────────────────────────────────────

export enum FocusZone {
  Canvas = 'Canvas',
  LeftPanel = 'LeftPanel',
  RightPanel = 'RightPanel',
  Dialog = 'Dialog',
  CommandPalette = 'CommandPalette',
  TextInput = 'TextInput',
}

// ─── Context ──────────────────────────────────────────────────────

interface FocusZoneContextValue {
  activeZone: FocusZone;
  setActiveZone: (zone: FocusZone) => void;
}

const FocusZoneContext = createContext<FocusZoneContextValue>({
  activeZone: FocusZone.Canvas,
  setActiveZone: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────

interface FocusZoneProviderProps {
  children: React.ReactNode;
}

export function FocusZoneProvider({ children }: FocusZoneProviderProps) {
  const [activeZone, setActiveZoneState] = useState<FocusZone>(FocusZone.Canvas);

  const setActiveZone = useCallback((zone: FocusZone) => {
    setActiveZoneState(zone);
  }, []);

  return React.createElement(
    FocusZoneContext.Provider,
    { value: { activeZone, setActiveZone } },
    children,
  );
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useFocusZone() {
  const { activeZone, setActiveZone } = useContext(FocusZoneContext);

  return {
    activeZone,
    setActiveZone,
    isCanvasFocused: activeZone === FocusZone.Canvas,
    isInputFocused:
      activeZone === FocusZone.TextInput ||
      activeZone === FocusZone.CommandPalette,
    isDialogFocused: activeZone === FocusZone.Dialog,
    isPanelFocused:
      activeZone === FocusZone.LeftPanel || activeZone === FocusZone.RightPanel,
  };
}

// ─── FocusZoneRegion Component ────────────────────────────────────

/**
 * Wrapper component that automatically registers a focus zone on focus/blur.
 * When any element inside this region receives focus, the activeZone updates.
 * When focus leaves to an element outside this region, the zone falls back to Canvas.
 *
 * For TextInput detection, focuses on INPUT/TEXTAREA/contentEditable elements
 * automatically override the zone to TextInput regardless of the region's zone.
 */
interface FocusZoneRegionProps {
  zone: FocusZone;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

export function FocusZoneRegion({
  zone,
  children,
  className,
  style,
  'data-testid': testId,
}: FocusZoneRegionProps) {
  const { setActiveZone } = useContext(FocusZoneContext);
  const regionRef = useRef<HTMLDivElement>(null);

  const handleFocusIn = useCallback(
    (e: React.FocusEvent) => {
      const target = e.target as HTMLElement;
      // If the focus landed on a text-input element, override to TextInput zone
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        setActiveZone(FocusZone.TextInput);
      } else {
        setActiveZone(zone);
      }
    },
    [zone, setActiveZone],
  );

  const handleFocusOut = useCallback(
    (e: React.FocusEvent) => {
      // Only reset if focus is leaving this region entirely
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget && regionRef.current?.contains(relatedTarget)) {
        return; // Focus moved to another element within the same region
      }
      // Fall back to Canvas when focus leaves a region
      setActiveZone(FocusZone.Canvas);
    },
    [setActiveZone],
  );

  return React.createElement(
    'div',
    {
      ref: regionRef,
      onFocus: handleFocusIn,
      onBlur: handleFocusOut,
      className,
      style,
      'data-testid': testId,
      'data-focus-zone': zone,
    },
    children,
  );
}

// ─── Utility: Check if current active element is a text input ─────

/**
 * Checks the currently focused DOM element to determine if it's a text input.
 * This is a direct DOM check that can be used outside of React context,
 * e.g., in global keyboard handlers.
 */
export function isActiveElementTextInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    (el as HTMLElement).isContentEditable === true
  );
}

// Re-export context for testing
export { FocusZoneContext };
