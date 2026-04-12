import { describe, it, expect } from 'vitest';
import {
  LAYOUT_PROFILES,
  LAYOUT_PROFILE_IDS,
  settingsMatchProfile,
} from '@/core/theme/layoutProfiles';
import type { LayoutProfile } from '@/core/theme/layoutProfiles';

describe('layoutProfiles', () => {
  it('defines exactly three profiles', () => {
    expect(Object.keys(LAYOUT_PROFILES)).toHaveLength(3);
  });

  it('LAYOUT_PROFILE_IDS matches LAYOUT_PROFILES keys', () => {
    expect(LAYOUT_PROFILE_IDS).toEqual(Object.keys(LAYOUT_PROFILES));
  });

  it.each(LAYOUT_PROFILE_IDS)('profile "%s" has all required fields', (id) => {
    const p: LayoutProfile = LAYOUT_PROFILES[id];
    expect(p.id).toBe(id);
    expect(typeof p.name).toBe('string');
    expect(typeof p.description).toBe('string');
    expect(p.uiScale).toBeGreaterThanOrEqual(80);
    expect(p.uiScale).toBeLessThanOrEqual(150);
    expect(['compact', 'comfortable', 'expanded']).toContain(p.statusBarDensity);
    expect(['narrow', 'standard', 'wide']).toContain(p.sidebarWidthPreset);
    expect(p.toolbarButtonSize).toBeGreaterThan(0);
    expect(p.nodeTextScale).toBeGreaterThan(0);
  });

  describe('settingsMatchProfile', () => {
    const balanced = LAYOUT_PROFILES.balanced;

    it('returns true when all settings match', () => {
      expect(settingsMatchProfile(balanced, {
        uiScale: 100,
        statusBarDensity: 'comfortable',
        sidebarWidthPreset: 'standard',
        toolbarButtonSize: 36,
        nodeTextScale: 1,
      })).toBe(true);
    });

    it('returns false when uiScale differs', () => {
      expect(settingsMatchProfile(balanced, {
        uiScale: 110,
        statusBarDensity: 'comfortable',
        sidebarWidthPreset: 'standard',
        toolbarButtonSize: 36,
        nodeTextScale: 1,
      })).toBe(false);
    });

    it('returns false when toolbarButtonSize differs', () => {
      expect(settingsMatchProfile(balanced, {
        uiScale: 100,
        statusBarDensity: 'comfortable',
        sidebarWidthPreset: 'standard',
        toolbarButtonSize: 44,
        nodeTextScale: 1,
      })).toBe(false);
    });

    it('returns false when nodeTextScale differs', () => {
      expect(settingsMatchProfile(balanced, {
        uiScale: 100,
        statusBarDensity: 'comfortable',
        sidebarWidthPreset: 'standard',
        toolbarButtonSize: 36,
        nodeTextScale: 0.833,
      })).toBe(false);
    });

    it('returns false when statusBarDensity differs', () => {
      expect(settingsMatchProfile(balanced, {
        uiScale: 100,
        statusBarDensity: 'compact',
        sidebarWidthPreset: 'standard',
        toolbarButtonSize: 36,
        nodeTextScale: 1,
      })).toBe(false);
    });

    it('returns false when sidebarWidthPreset differs', () => {
      expect(settingsMatchProfile(balanced, {
        uiScale: 100,
        statusBarDensity: 'comfortable',
        sidebarWidthPreset: 'wide',
        toolbarButtonSize: 36,
        nodeTextScale: 1,
      })).toBe(false);
    });
  });
});
