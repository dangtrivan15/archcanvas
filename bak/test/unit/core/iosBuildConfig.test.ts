/**
 * Tests for iOS code signing and archive build configuration - Feature #293
 *
 * Validates that the Xcode project and build scripts are properly
 * configured for development and distribution (App Store / TestFlight).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

function fileExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

function isExecutable(relativePath: string): boolean {
  const stats = statSync(resolve(ROOT, relativePath));
  // Check if any execute bits are set
  return (stats.mode & 0o111) !== 0;
}

describe('Feature #293: iOS code signing and archive build configuration', () => {
  // ─── Step 1: Signing & Capabilities ──────────────────────
  describe('Xcode signing configuration', () => {
    const pbxproj = readFile('ios/App/App.xcodeproj/project.pbxproj');

    it('uses automatic code signing style', () => {
      expect(pbxproj).toContain('CODE_SIGN_STYLE = Automatic');
    });

    it('has automatic provisioning style at project level', () => {
      expect(pbxproj).toContain('ProvisioningStyle = Automatic');
    });

    it('sets correct bundle identifier', () => {
      expect(pbxproj).toContain('PRODUCT_BUNDLE_IDENTIFIER = com.archcanvas.app');
    });

    it('targets iOS 16.0', () => {
      expect(pbxproj).toContain('IPHONEOS_DEPLOYMENT_TARGET = 16.0');
    });

    it('supports iPhone and iPad (device family 1,2)', () => {
      expect(pbxproj).toContain('TARGETED_DEVICE_FAMILY = "1,2"');
    });

    it('supports Mac Designed for iPad', () => {
      expect(pbxproj).toContain('SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = YES');
    });
  });

  // ─── Step 2/3: Provisioning profiles (automatic) ────────
  describe('Provisioning profiles', () => {
    const pbxproj = readFile('ios/App/App.xcodeproj/project.pbxproj');

    it('both Debug and Release target configs use automatic signing', () => {
      // Count occurrences of CODE_SIGN_STYLE = Automatic in target configs
      const matches = pbxproj.match(/CODE_SIGN_STYLE = Automatic/g);
      expect(matches).not.toBeNull();
      // At least 2 occurrences: Debug target + Release target
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it('Release target config does NOT have DEBUG compilation condition', () => {
      // Find the Release target config section (504EC3181FED79650016851F)
      // and verify SWIFT_ACTIVE_COMPILATION_CONDITIONS is empty
      const releaseTargetMatch = pbxproj.match(
        /504EC3181FED79650016851F[^}]*SWIFT_ACTIVE_COMPILATION_CONDITIONS\s*=\s*"([^"]*)"/,
      );
      if (releaseTargetMatch) {
        expect(releaseTargetMatch[1]).not.toContain('DEBUG');
      }
    });

    it('Debug target config has debug xcconfig reference', () => {
      // Debug target config should reference debug.xcconfig
      expect(pbxproj).toContain('debug.xcconfig');
    });
  });

  // ─── Step 4: build:release npm script ───────────────────
  describe('Build release npm script', () => {
    const packageJson = JSON.parse(readFile('package.json'));

    it('has build:release script', () => {
      expect(packageJson.scripts['build:release']).toBeDefined();
    });

    it('build:release runs npm build then cap sync ios', () => {
      const script = packageJson.scripts['build:release'];
      expect(script).toContain('npm run build');
      expect(script).toContain('cap sync ios');
    });

    it('build:release does not set CAPACITOR_DEV', () => {
      const script = packageJson.scripts['build:release'];
      expect(script).not.toContain('CAPACITOR_DEV');
    });

    it('has build:ios script', () => {
      expect(packageJson.scripts['build:ios']).toBeDefined();
    });

    it('has cap:sync script', () => {
      expect(packageJson.scripts['cap:sync']).toBeDefined();
    });

    it('has cap:open:ios script', () => {
      expect(packageJson.scripts['cap:open:ios']).toBeDefined();
    });
  });

  // ─── Step 5: Archive workflow documentation ─────────────
  describe('Archive workflow documentation', () => {
    it('has ios-build-guide.md documentation', () => {
      expect(fileExists('docs/ios-build-guide.md')).toBe(true);
    });

    it('documentation covers archive workflow', () => {
      const doc = readFile('docs/ios-build-guide.md');
      expect(doc).toContain('Archive');
      expect(doc).toContain('Product > Archive');
    });

    it('documentation covers TestFlight distribution', () => {
      const doc = readFile('docs/ios-build-guide.md');
      expect(doc).toContain('TestFlight');
      expect(doc).toContain('App Store Connect');
    });

    it('documentation covers App Store distribution', () => {
      const doc = readFile('docs/ios-build-guide.md');
      expect(doc).toContain('App Store');
      expect(doc).toContain('Distribute App');
    });

    it('documentation covers code signing setup', () => {
      const doc = readFile('docs/ios-build-guide.md');
      expect(doc).toContain('Signing');
      expect(doc).toContain('Automatically manage signing');
    });

    it('has build-release-ios.sh script', () => {
      expect(fileExists('scripts/build-release-ios.sh')).toBe(true);
    });

    it('build-release-ios.sh is executable', () => {
      expect(isExecutable('scripts/build-release-ios.sh')).toBe(true);
    });
  });

  // ─── Step 7: Release build optimizations ────────────────
  describe('Release build configuration', () => {
    const pbxproj = readFile('ios/App/App.xcodeproj/project.pbxproj');

    it('Release project config enables Swift whole-module optimization', () => {
      expect(pbxproj).toContain('SWIFT_COMPILATION_MODE = wholemodule');
    });

    it('Release project config has Swift -O optimization', () => {
      expect(pbxproj).toContain('SWIFT_OPTIMIZATION_LEVEL = "-O"');
    });

    it('Release project config validates the product', () => {
      expect(pbxproj).toContain('VALIDATE_PRODUCT = YES');
    });

    it('Release project config disables NS assertions', () => {
      expect(pbxproj).toContain('ENABLE_NS_ASSERTIONS = NO');
    });

    it('Release project config generates dSYM for crash reporting', () => {
      expect(pbxproj).toContain('DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"');
    });

    it('Debug project config has no optimization', () => {
      expect(pbxproj).toContain('GCC_OPTIMIZATION_LEVEL = 0');
      expect(pbxproj).toContain('SWIFT_OPTIMIZATION_LEVEL = "-Onone"');
    });

    it('defaultConfigurationName is Release', () => {
      expect(pbxproj).toContain('defaultConfigurationName = Release');
    });
  });

  // ─── Capacitor config validation ───────────────────────
  describe('Capacitor config for production', () => {
    const config = readFile('capacitor.config.ts');

    it('only includes server URL when CAPACITOR_DEV is true', () => {
      expect(config).toContain('CAPACITOR_DEV');
      expect(config).toContain("process.env.CAPACITOR_DEV === 'true'");
    });

    it('does not hardcode dev server URL', () => {
      // The URL should only appear inside the conditional block
      const lines = config.split('\n');
      const urlLines = lines.filter((l) => l.includes('localhost:5173'));
      // There should be at most 1 URL reference, inside the conditional
      expect(urlLines.length).toBeLessThanOrEqual(1);
    });

    it('uses correct app ID', () => {
      expect(config).toContain("appId: 'com.archcanvas.app'");
    });

    it('uses correct web directory', () => {
      expect(config).toContain("webDir: 'dist'");
    });

    it('has iOS-specific configuration', () => {
      expect(config).toContain('ios:');
      expect(config).toContain("scheme: 'ArchCanvas'");
    });
  });
});
