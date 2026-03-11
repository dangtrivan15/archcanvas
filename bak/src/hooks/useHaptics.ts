/**
 * useHaptics — Cross-platform haptic feedback for touch interactions.
 *
 * Wraps @capacitor/haptics to provide tactile feedback on iPad (native).
 * Gracefully no-ops on web/non-Capacitor environments.
 *
 * Provides three feedback types:
 * - impact(style): Physical tap sensation (Light, Medium, Heavy)
 * - notification(type): Success, Warning, Error feedback
 * - selectionChanged(): Subtle tick for selection changes
 *
 * All methods check:
 * 1. Whether haptics are enabled in user preferences (uiStore)
 * 2. Whether the platform supports haptics (Capacitor native only)
 *
 * Usage:
 *   const haptics = useHaptics();
 *   haptics.impact('Light');
 *   haptics.notification('Success');
 *   haptics.selectionChanged();
 */

import { useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useUIStore } from '@/store/uiStore';

/** Impact feedback styles matching @capacitor/haptics ImpactStyle */
export type HapticImpactStyle = 'Heavy' | 'Medium' | 'Light';

/** Notification feedback types matching @capacitor/haptics NotificationType */
export type HapticNotificationType = 'Success' | 'Warning' | 'Error';

/**
 * Lazily load the Haptics plugin. Returns null if not available.
 * Caches the import result to avoid repeated dynamic imports.
 */
let hapticsModulePromise: Promise<typeof import('@capacitor/haptics') | null> | null = null;

function getHapticsModule() {
  if (!hapticsModulePromise) {
    if (!Capacitor.isNativePlatform()) {
      hapticsModulePromise = Promise.resolve(null);
    } else {
      hapticsModulePromise = import('@capacitor/haptics').catch(() => null);
    }
  }
  return hapticsModulePromise;
}

/**
 * Fire-and-forget haptic impact. No-ops silently on web.
 */
async function doImpact(style: HapticImpactStyle): Promise<void> {
  const mod = await getHapticsModule();
  if (!mod) return;
  try {
    await mod.Haptics.impact({ style: mod.ImpactStyle[style] });
  } catch {
    // Silently ignore — device may not support haptics
  }
}

/**
 * Fire-and-forget haptic notification. No-ops silently on web.
 */
async function doNotification(type: HapticNotificationType): Promise<void> {
  const mod = await getHapticsModule();
  if (!mod) return;
  try {
    await mod.Haptics.notification({ type: mod.NotificationType[type] });
  } catch {
    // Silently ignore
  }
}

/**
 * Fire-and-forget selection changed haptic. No-ops silently on web.
 */
async function doSelectionChanged(): Promise<void> {
  const mod = await getHapticsModule();
  if (!mod) return;
  try {
    await mod.Haptics.selectionChanged();
  } catch {
    // Silently ignore
  }
}

export interface HapticActions {
  /** Physical tap sensation */
  impact: (style?: HapticImpactStyle) => void;
  /** Notification feedback (success/warning/error) */
  notification: (type?: HapticNotificationType) => void;
  /** Subtle tick for selection changes */
  selectionChanged: () => void;
}

/**
 * Hook providing haptic feedback actions gated by user preference.
 *
 * All methods are stable (never change identity) and safe to call
 * unconditionally — they check the preference at call time.
 */
export function useHaptics(): HapticActions {
  // Read the preference at call time via ref to avoid re-renders
  const enabledRef = useRef(true);
  enabledRef.current = useUIStore.getState().hapticFeedbackEnabled;

  const impact = useCallback((style: HapticImpactStyle = 'Light') => {
    if (enabledRef.current) doImpact(style);
  }, []);

  const notification = useCallback((type: HapticNotificationType = 'Success') => {
    if (enabledRef.current) doNotification(type);
  }, []);

  const selectionChanged = useCallback(() => {
    if (enabledRef.current) doSelectionChanged();
  }, []);

  return { impact, notification, selectionChanged };
}

/**
 * Standalone haptic helpers for use outside React components (e.g., in stores).
 * Checks the uiStore preference at call time.
 */
export const haptics = {
  impact(style: HapticImpactStyle = 'Light') {
    if (useUIStore.getState().hapticFeedbackEnabled) doImpact(style);
  },
  notification(type: HapticNotificationType = 'Success') {
    if (useUIStore.getState().hapticFeedbackEnabled) doNotification(type);
  },
  selectionChanged() {
    if (useUIStore.getState().hapticFeedbackEnabled) doSelectionChanged();
  },
};
