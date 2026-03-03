/**
 * Platform detection utility.
 *
 * Detects the user's OS/platform and exports a singleton `currentPlatform`.
 * Future-proofed for iPad/tablet support — just add a new platform mapping.
 *
 * Supported platforms: 'mac' | 'windows' | 'linux' | 'ipad' | 'unknown'
 */

export type Platform = 'mac' | 'windows' | 'linux' | 'ipad' | 'unknown';

/**
 * Detect the current platform from browser APIs.
 * Uses navigator.userAgentData (modern) with fallback to navigator.platform/userAgent.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';

  // Modern User-Agent Client Hints API (Chrome 90+)
  const uaData = (navigator as any).userAgentData;
  if (uaData?.platform) {
    const p = uaData.platform.toLowerCase();
    if (p === 'macos') return 'mac';
    if (p === 'windows') return 'windows';
    if (p === 'linux' || p === 'chromeos') return 'linux';
  }

  // Fallback: navigator.platform + userAgent
  const platform = (navigator.platform || '').toLowerCase();
  const ua = (navigator.userAgent || '').toLowerCase();

  // iPad detection (iPadOS 13+ reports as Mac in navigator.platform)
  if (/ipad/i.test(platform) || (/mac/i.test(platform) && 'ontouchstart' in window && navigator.maxTouchPoints > 1)) {
    return 'ipad';
  }

  if (/mac/i.test(platform)) return 'mac';
  if (/win/i.test(platform)) return 'windows';
  if (/linux/i.test(platform)) return 'linux';

  // Additional userAgent fallbacks
  if (/ipad/i.test(ua)) return 'ipad';
  if (/macintosh|mac os/i.test(ua)) return 'mac';
  if (/windows/i.test(ua)) return 'windows';
  if (/linux/i.test(ua)) return 'linux';

  return 'unknown';
}

/**
 * Whether the platform uses Cmd (⌘) as the primary modifier.
 * Mac and iPad use Cmd; Windows and Linux use Ctrl.
 */
export function isCmdPlatform(platform: Platform): boolean {
  return platform === 'mac' || platform === 'ipad';
}

/**
 * Global singleton — detected once at module load.
 * Override with `_setPlatformForTesting()` in tests.
 */
let _currentPlatform: Platform = detectPlatform();

export function getCurrentPlatform(): Platform {
  return _currentPlatform;
}

/**
 * For unit tests only — override the detected platform.
 */
export function _setPlatformForTesting(platform: Platform): void {
  _currentPlatform = platform;
}

/**
 * For unit tests only — reset to auto-detected value.
 */
export function _resetPlatformDetection(): void {
  _currentPlatform = detectPlatform();
}
