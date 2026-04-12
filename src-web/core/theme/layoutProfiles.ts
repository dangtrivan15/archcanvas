import type { StatusBarDensity } from '@/store/themeStore';
import type { SidebarWidthPreset } from '@/store/uiStore';

export type LayoutProfileId = 'compact' | 'balanced' | 'spacious';

export interface LayoutProfile {
  id: LayoutProfileId;
  name: string;
  description: string;
  uiScale: number;
  statusBarDensity: StatusBarDensity;
  sidebarWidthPreset: SidebarWidthPreset;
  toolbarButtonSize: number;   // px value, e.g. 36
  nodeTextScale: number;       // multiplier, e.g. 0.833
}

export const LAYOUT_PROFILES: Readonly<Record<LayoutProfileId, LayoutProfile>> = {
  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Maximize canvas area',
    uiScale: 85,
    statusBarDensity: 'compact',
    sidebarWidthPreset: 'narrow',
    toolbarButtonSize: 36,
    nodeTextScale: 0.833,
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default layout',
    uiScale: 100,
    statusBarDensity: 'comfortable',
    sidebarWidthPreset: 'standard',
    toolbarButtonSize: 36,
    nodeTextScale: 1,
  },
  spacious: {
    id: 'spacious',
    name: 'Spacious',
    description: 'Larger UI for high-DPI & presentations',
    uiScale: 120,
    statusBarDensity: 'expanded',
    sidebarWidthPreset: 'wide',
    toolbarButtonSize: 44,
    nodeTextScale: 1.167,
  },
};

export const LAYOUT_PROFILE_IDS: readonly LayoutProfileId[] = ['compact', 'balanced', 'spacious'];

/**
 * Check whether current settings match a given profile exactly.
 * Used for profile indicator UI -- returns true only if ALL profile-controlled
 * settings are at the profile's expected values.
 */
export function settingsMatchProfile(
  profile: LayoutProfile,
  current: {
    uiScale: number;
    statusBarDensity: StatusBarDensity;
    sidebarWidthPreset: SidebarWidthPreset;
    toolbarButtonSize: number;
    nodeTextScale: number;
  },
): boolean {
  return (
    current.uiScale === profile.uiScale &&
    current.statusBarDensity === profile.statusBarDensity &&
    current.sidebarWidthPreset === profile.sidebarWidthPreset &&
    current.toolbarButtonSize === profile.toolbarButtonSize &&
    current.nodeTextScale === profile.nodeTextScale
  );
}
