/**
 * Platform Bridge — Runtime context detection for Capacitor native vs web.
 *
 * Extends the existing platformDetector.ts (which detects the user's OS) with
 * runtime context detection (native Capacitor shell vs plain browser).
 *
 * Uses Capacitor.isNativePlatform() and Capacitor.getPlatform() from @capacitor/core.
 * In a web browser (no Capacitor shell), isNativePlatform() returns false and
 * getPlatform() returns 'web'.
 *
 * All platform-conditional code (e.g. File System Access API vs Capacitor Filesystem,
 * safe-area insets, status bar styling) should branch on these helpers.
 */

import { Capacitor } from '@capacitor/core';

/** Runtime platform type: 'web' for browser, 'ios' for Capacitor iOS */
export type PlatformType = 'web' | 'ios';

/**
 * Returns true when running inside a Capacitor native shell (iOS WKWebView).
 * Returns false in a regular browser.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns true when running in a regular browser (not inside Capacitor).
 */
export function isWeb(): boolean {
  return !Capacitor.isNativePlatform();
}

/**
 * Returns true when running inside the Capacitor iOS shell.
 */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * Returns the current runtime platform type.
 * - 'ios' when running inside Capacitor iOS shell
 * - 'web' when running in a regular browser
 */
export function getPlatformType(): PlatformType {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'ios';
  return 'web';
}
