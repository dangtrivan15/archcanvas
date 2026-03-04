#!/usr/bin/env node
/**
 * Generate iOS app icons and splash screen images from the ArchCanvas SVG sources.
 * Uses Node.js built-in capabilities + the existing PNG/SVG icon files.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PUBLIC_ICONS = path.join(__dirname, '..', 'public', 'icons');
const APP_ICON_DIR = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const SPLASH_DIR = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');

// Use sips (macOS built-in) for image resizing
function resizeImage(src, dest, size) {
  // Copy first, then resize in place
  fs.copyFileSync(src, dest);
  execSync(`sips -z ${size} ${size} "${dest}" --out "${dest}"`, { stdio: 'pipe' });
}

// Generate the 1024x1024 app icon from our 512x512 source
// For iOS 16+ with modern Xcode, only 1024x1024 universal is needed
function generateAppIcon() {
  const src = path.join(PUBLIC_ICONS, 'icon-512x512.png');
  const dest = path.join(APP_ICON_DIR, 'AppIcon-1024x1024.png');

  // Copy and resize to 1024x1024
  fs.copyFileSync(src, dest);
  execSync(`sips -z 1024 1024 "${dest}" --out "${dest}"`, { stdio: 'pipe' });

  // Also generate legacy sizes for broader compatibility
  const sizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180];
  for (const size of sizes) {
    const sizeDest = path.join(APP_ICON_DIR, `AppIcon-${size}x${size}.png`);
    fs.copyFileSync(src, sizeDest);
    execSync(`sips -z ${size} ${size} "${sizeDest}" --out "${sizeDest}"`, { stdio: 'pipe' });
  }

  // Remove old Capacitor default icon
  const oldIcon = path.join(APP_ICON_DIR, 'AppIcon-512@2x.png');
  if (fs.existsSync(oldIcon)) {
    fs.unlinkSync(oldIcon);
  }

  // Write updated Contents.json with all sizes
  const contentsJson = {
    "images": [
      { "filename": "AppIcon-1024x1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024" },
      { "filename": "AppIcon-20x20.png", "idiom": "iphone", "scale": "2x", "size": "20x20" },
      { "filename": "AppIcon-29x29.png", "idiom": "iphone", "scale": "2x", "size": "29x29" },
      { "filename": "AppIcon-40x40.png", "idiom": "iphone", "scale": "2x", "size": "40x40" },
      { "filename": "AppIcon-60x60.png", "idiom": "iphone", "scale": "2x", "size": "60x60" },
      { "filename": "AppIcon-58x58.png", "idiom": "iphone", "scale": "3x", "size": "29x29" },
      { "filename": "AppIcon-87x87.png", "idiom": "iphone", "scale": "3x", "size": "29x29" },
      { "filename": "AppIcon-80x80.png", "idiom": "iphone", "scale": "3x", "size": "40x40" },
      { "filename": "AppIcon-120x120.png", "idiom": "iphone", "scale": "3x", "size": "60x60" },
      { "filename": "AppIcon-76x76.png", "idiom": "ipad", "scale": "1x", "size": "76x76" },
      { "filename": "AppIcon-152x152.png", "idiom": "ipad", "scale": "2x", "size": "76x76" },
      { "filename": "AppIcon-167x167.png", "idiom": "ipad", "scale": "2x", "size": "83.5x83.5" },
      { "filename": "AppIcon-180x180.png", "idiom": "iphone", "scale": "3x", "size": "60x60" }
    ],
    "info": { "author": "xcode", "version": 1 }
  };

  fs.writeFileSync(
    path.join(APP_ICON_DIR, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2) + '\n'
  );

  // Log results
  const files = fs.readdirSync(APP_ICON_DIR).filter(f => f.endsWith('.png'));
  process.stderr.write(`Generated ${files.length} app icon files\n`);
}

// Generate splash screen images with dark background and centered logo
function generateSplashScreen() {
  // We need to create splash images with dark background (#1a1a2e)
  // and the ArchCanvas logo centered.
  // Using sips + a generated SVG approach

  const splashSizes = [2732]; // iPad Pro max size, works for all devices
  const logoSrc = path.join(PUBLIC_ICONS, 'icon-512x512.png');

  // Create a dark background SVG, render to PNG, then composite
  // Since we can't easily composite with sips alone, let's use a different approach:
  // Create an SVG with embedded base64 PNG logo on dark background

  const logoData = fs.readFileSync(logoSrc);
  const logoBase64 = logoData.toString('base64');

  for (const size of splashSizes) {
    const logoSize = Math.round(size * 0.15); // Logo is 15% of splash size
    const logoX = Math.round((size - logoSize) / 2);
    const logoY = Math.round((size - logoSize) / 2);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1a1a2e"/>
  <image x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" href="data:image/png;base64,${logoBase64}"/>
</svg>`;

    const svgPath = path.join(SPLASH_DIR, `splash-${size}x${size}.svg`);
    fs.writeFileSync(svgPath, svg);

    // Try to convert SVG to PNG using built-in tools
    // On macOS, we can use qlmanage or rsvg-convert, but let's try a simpler approach
    // We'll use the SVG directly and let Xcode handle it, or use node canvas
    process.stderr.write(`Created SVG splash at ${svgPath}\n`);
  }
}

// Main
try {
  generateAppIcon();
  generateSplashScreen();
  process.stderr.write('Done generating iOS assets\n');
} catch (err) {
  process.stderr.write('Error: ' + err.message + '\n');
  process.exit(1);
}
