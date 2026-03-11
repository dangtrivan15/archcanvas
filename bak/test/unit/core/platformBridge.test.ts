/**
 * Tests for src/core/platform/platformBridge.ts
 *
 * Feature #277: Platform detection utility for Capacitor native vs web
 *
 * Verifies that the platform bridge correctly detects whether the app
 * is running in a Capacitor native context or as a regular web app.
 * In the test environment (Node/happy-dom), Capacitor is not loaded
 * natively, so we mock it to test both web and native paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll mock @capacitor/core so we can control return values
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

import { Capacitor } from '@capacitor/core';
import { isNative, isWeb, isIOS, getPlatformType } from '@/core/platform/platformBridge';
import type { PlatformType } from '@/core/platform/platformBridge';

const mockCapacitor = Capacitor as unknown as {
  isNativePlatform: ReturnType<typeof vi.fn>;
  getPlatform: ReturnType<typeof vi.fn>;
};

describe('Feature #277: Platform detection utility (platformBridge)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Web browser context (default)', () => {
    beforeEach(() => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      mockCapacitor.getPlatform.mockReturnValue('web');
    });

    it('isNative() returns false in web browser', () => {
      expect(isNative()).toBe(false);
    });

    it('isWeb() returns true in web browser', () => {
      expect(isWeb()).toBe(true);
    });

    it('isIOS() returns false in web browser', () => {
      expect(isIOS()).toBe(false);
    });

    it('getPlatformType() returns "web" in web browser', () => {
      expect(getPlatformType()).toBe('web');
    });

    it('getPlatformType() return type satisfies PlatformType', () => {
      const result: PlatformType = getPlatformType();
      expect(['web', 'ios']).toContain(result);
    });
  });

  describe('Capacitor iOS context', () => {
    beforeEach(() => {
      mockCapacitor.isNativePlatform.mockReturnValue(true);
      mockCapacitor.getPlatform.mockReturnValue('ios');
    });

    it('isNative() returns true on iOS', () => {
      expect(isNative()).toBe(true);
    });

    it('isWeb() returns false on iOS', () => {
      expect(isWeb()).toBe(false);
    });

    it('isIOS() returns true on iOS', () => {
      expect(isIOS()).toBe(true);
    });

    it('getPlatformType() returns "ios" on iOS', () => {
      expect(getPlatformType()).toBe('ios');
    });
  });

  describe('Edge cases', () => {
    it('unknown platform returns "web" as fallback', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(true);
      mockCapacitor.getPlatform.mockReturnValue('android');
      // Even if Capacitor says native, if platform is not ios, getPlatformType returns "web"
      expect(getPlatformType()).toBe('web');
    });

    it('isNative and isWeb are always inverse', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      expect(isNative()).toBe(!isWeb());

      mockCapacitor.isNativePlatform.mockReturnValue(true);
      expect(isNative()).toBe(!isWeb());
    });

    it('delegates to Capacitor.isNativePlatform() directly', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      isNative();
      expect(mockCapacitor.isNativePlatform).toHaveBeenCalled();
    });

    it('delegates to Capacitor.getPlatform() for type detection', () => {
      mockCapacitor.getPlatform.mockReturnValue('web');
      getPlatformType();
      expect(mockCapacitor.getPlatform).toHaveBeenCalled();
    });
  });

  describe('Source code structure', () => {
    it('exports isNative function', () => {
      expect(typeof isNative).toBe('function');
    });

    it('exports isWeb function', () => {
      expect(typeof isWeb).toBe('function');
    });

    it('exports isIOS function', () => {
      expect(typeof isIOS).toBe('function');
    });

    it('exports getPlatformType function', () => {
      expect(typeof getPlatformType).toBe('function');
    });

    it('getPlatformType returns only valid PlatformType values', () => {
      const validTypes: PlatformType[] = ['web', 'ios'];

      // Test web
      mockCapacitor.getPlatform.mockReturnValue('web');
      expect(validTypes).toContain(getPlatformType());

      // Test ios
      mockCapacitor.getPlatform.mockReturnValue('ios');
      expect(validTypes).toContain(getPlatformType());
    });
  });

  describe('Integration with Capacitor API', () => {
    it('isIOS uses Capacitor.getPlatform() === "ios"', () => {
      mockCapacitor.getPlatform.mockReturnValue('ios');
      expect(isIOS()).toBe(true);

      mockCapacitor.getPlatform.mockReturnValue('web');
      expect(isIOS()).toBe(false);

      mockCapacitor.getPlatform.mockReturnValue('android');
      expect(isIOS()).toBe(false);
    });

    it('consistent state: native ios has isNative=true, isWeb=false, isIOS=true', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(true);
      mockCapacitor.getPlatform.mockReturnValue('ios');

      expect(isNative()).toBe(true);
      expect(isWeb()).toBe(false);
      expect(isIOS()).toBe(true);
      expect(getPlatformType()).toBe('ios');
    });

    it('consistent state: web has isNative=false, isWeb=true, isIOS=false', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      mockCapacitor.getPlatform.mockReturnValue('web');

      expect(isNative()).toBe(false);
      expect(isWeb()).toBe(true);
      expect(isIOS()).toBe(false);
      expect(getPlatformType()).toBe('web');
    });
  });
});
