/**
 * React hook for platform-aware modifier key information.
 *
 * Provides the current platform's primary modifier key symbol, label,
 * and an event matcher — so components can display correct shortcut hints
 * and check events without inline platform detection.
 *
 * Usage:
 *   const { primarySymbol, primaryLabel, isPrimary, formatBinding } = usePlatformModifier();
 *   // primarySymbol → '⌘' (Mac) or 'Ctrl' (Win/Linux)
 *   // isPrimary(event) → true if Cmd (Mac) or Ctrl (Win) is pressed
 *   // formatBinding('mod+s') → '⌘ S' (Mac) or 'Ctrl+S' (Win)
 */

import { useMemo } from 'react';
import {
  getCurrentPlatform,
  isCmdPlatform,
  getCurrentModifierMap,
  formatBindingDisplay,
  isPrimaryModifier,
  type Platform,
  type PlatformModifierMap,
} from '@/core/input';

export interface PlatformModifierResult {
  /** Current detected platform */
  platform: Platform;
  /** Whether this platform uses Cmd (Mac/iPad) vs Ctrl (Win/Linux) */
  isMac: boolean;
  /** Primary modifier symbol: '⌘' or 'Ctrl' */
  primarySymbol: string;
  /** Primary modifier label: 'Cmd' or 'Ctrl' */
  primaryLabel: string;
  /** Secondary modifier symbol: '⇧' or 'Shift' */
  secondarySymbol: string;
  /** Tertiary modifier symbol: '⌥' or 'Alt' */
  tertiarySymbol: string;
  /** Full modifier map */
  modifierMap: PlatformModifierMap;
  /** Check if the primary modifier is pressed in an event */
  isPrimary: (event: KeyboardEvent | MouseEvent) => boolean;
  /** Format a binding string for display (e.g., "mod+s" → "⌘ S" or "Ctrl+S") */
  formatBinding: (binding: string) => string;
}

/**
 * Hook that returns platform-aware modifier information.
 * The value is memoized and stable across re-renders (platform doesn't change).
 */
export function usePlatformModifier(): PlatformModifierResult {
  return useMemo(() => {
    const platform = getCurrentPlatform();
    const mac = isCmdPlatform(platform);
    const modifierMap = getCurrentModifierMap();

    return {
      platform,
      isMac: mac,
      primarySymbol: modifierMap.primary.symbol,
      primaryLabel: modifierMap.primary.label,
      secondarySymbol: modifierMap.secondary.symbol,
      tertiarySymbol: modifierMap.tertiary.symbol,
      modifierMap,
      isPrimary: (event: KeyboardEvent | MouseEvent) => isPrimaryModifier(event, platform),
      formatBinding: (binding: string) => formatBindingDisplay(binding, platform),
    };
  }, []);
}
