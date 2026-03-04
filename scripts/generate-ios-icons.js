#!/usr/bin/env node
/**
 * Generate iOS app icons and splash screen images from the ArchCanvas SVG/PNG sources.
 * Uses sharp for image processing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_ICONS = path.join(__dirname, '..', 'public', 'icons');
const APP_ICON_DIR = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const SPLASH_DIR = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');

async function generateAppIcon() {
  // Use the SVG source for best quality rendering at any size
  const svgSrc = path.join(PUBLIC_ICONS, 'icon-512x512.svg');
  const svgBuffer = fs.readFileSync(svgSrc);

  // Generate 1024x1024 universal icon (primary, required for iOS 16+)
  const sizes = [1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20];

  for (const size of sizes) {
    const dest = path.join(APP_ICON_DIR, `AppIcon-${size}x${size}.png`);
    await sharp(svgBuffer, { density: Math.ceil(size * 72 / 512) * 2 })
      .resize(size, size)
      .png()
      .toFile(dest);
    console.error(`  Generated AppIcon-${size}x${size}.png`);
  }

  // Remove old Capacitor default icon
  const oldIcon = path.join(APP_ICON_DIR, 'AppIcon-512@2x.png');
  if (fs.existsSync(oldIcon)) {
    fs.unlinkSync(oldIcon);
    console.error('  Removed old Capacitor AppIcon-512@2x.png');
  }

  // Write updated Contents.json
  const contentsJson = {
    "images": [
      { "filename": "AppIcon-1024x1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024" },
      { "filename": "AppIcon-20x20.png", "idiom": "iphone", "scale": "2x", "size": "20x20" },
      { "filename": "AppIcon-40x40.png", "idiom": "iphone", "scale": "2x", "size": "40x40" },
      { "filename": "AppIcon-58x58.png", "idiom": "iphone", "scale": "2x", "size": "29x29" },
      { "filename": "AppIcon-60x60.png", "idiom": "iphone", "scale": "2x", "size": "60x60" },
      { "filename": "AppIcon-29x29.png", "idiom": "iphone", "scale": "3x", "size": "29x29" },
      { "filename": "AppIcon-80x80.png", "idiom": "iphone", "scale": "3x", "size": "40x40" },
      { "filename": "AppIcon-87x87.png", "idiom": "iphone", "scale": "3x", "size": "29x29" },
      { "filename": "AppIcon-120x120.png", "idiom": "iphone", "scale": "3x", "size": "60x60" },
      { "filename": "AppIcon-180x180.png", "idiom": "iphone", "scale": "3x", "size": "60x60" },
      { "filename": "AppIcon-20x20.png", "idiom": "ipad", "scale": "1x", "size": "20x20" },
      { "filename": "AppIcon-40x40.png", "idiom": "ipad", "scale": "2x", "size": "20x20" },
      { "filename": "AppIcon-29x29.png", "idiom": "ipad", "scale": "1x", "size": "29x29" },
      { "filename": "AppIcon-58x58.png", "idiom": "ipad", "scale": "2x", "size": "29x29" },
      { "filename": "AppIcon-40x40.png", "idiom": "ipad", "scale": "1x", "size": "40x40" },
      { "filename": "AppIcon-80x80.png", "idiom": "ipad", "scale": "2x", "size": "40x40" },
      { "filename": "AppIcon-76x76.png", "idiom": "ipad", "scale": "1x", "size": "76x76" },
      { "filename": "AppIcon-152x152.png", "idiom": "ipad", "scale": "2x", "size": "76x76" },
      { "filename": "AppIcon-167x167.png", "idiom": "ipad", "scale": "2x", "size": "83.5x83.5" }
    ],
    "info": { "author": "xcode", "version": 1 }
  };

  fs.writeFileSync(
    path.join(APP_ICON_DIR, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2) + '\n'
  );

  const files = fs.readdirSync(APP_ICON_DIR).filter(f => f.endsWith('.png'));
  console.error(`AppIcon: ${files.length} icon files generated`);
}

async function generateSplashScreen() {
  // Create splash images: dark background (#1a1a2e) with centered ArchCanvas graph logo
  // 2732x2732 is the largest iPad Pro size, used for all devices
  const size = 2732;

  // Create a standalone graph SVG (nodes + edges only, no rounded rect frame)
  // Scale factor: graph content in original SVG spans ~300px, we want it ~600px on splash
  const graphSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="56 16 400 460">
  <line x1="256" y1="96" x2="136" y2="296" stroke="rgba(148, 163, 184, 0.6)" stroke-width="3" stroke-linecap="round"/>
  <line x1="256" y1="96" x2="376" y2="296" stroke="rgba(148, 163, 184, 0.6)" stroke-width="3" stroke-linecap="round"/>
  <line x1="136" y1="296" x2="256" y2="396" stroke="rgba(148, 163, 184, 0.6)" stroke-width="3" stroke-linecap="round"/>
  <line x1="376" y1="296" x2="256" y2="396" stroke="rgba(148, 163, 184, 0.6)" stroke-width="3" stroke-linecap="round"/>
  <line x1="136" y1="296" x2="376" y2="296" stroke="rgba(148, 163, 184, 0.6)" stroke-width="3" stroke-linecap="round"/>
  <circle cx="256" cy="96" r="32" fill="#60a5fa" opacity="0.3"/><circle cx="256" cy="96" r="28" fill="#60a5fa"/><circle cx="249" cy="89" r="9.8" fill="rgba(255,255,255,0.25)"/>
  <circle cx="136" cy="296" r="28" fill="#34d399" opacity="0.3"/><circle cx="136" cy="296" r="24" fill="#34d399"/><circle cx="130" cy="290" r="8.4" fill="rgba(255,255,255,0.25)"/>
  <circle cx="376" cy="296" r="28" fill="#34d399" opacity="0.3"/><circle cx="376" cy="296" r="24" fill="#34d399"/><circle cx="370" cy="290" r="8.4" fill="rgba(255,255,255,0.25)"/>
  <circle cx="256" cy="396" r="24" fill="#a78bfa" opacity="0.3"/><circle cx="256" cy="396" r="20" fill="#a78bfa"/><circle cx="251" cy="391" r="7" fill="rgba(255,255,255,0.25)"/>
</svg>`);

  const logoSize = 1000;

  // Render the graph SVG
  const logoBuffer = await sharp(graphSvg, { density: 144 })
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  // Create the dark background with centered graph
  const logoX = Math.round((size - logoSize) / 2);
  const logoY = Math.round((size - logoSize) / 2);

  const splashBuffer = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 26, g: 26, b: 46, alpha: 1 } // #1a1a2e
    }
  })
    .composite([{
      input: logoBuffer,
      left: logoX,
      top: logoY
    }])
    .png()
    .toBuffer();

  // Write all 3 scale variants (same image, iOS handles scaling)
  const variants = [
    'splash-2732x2732.png',
    'splash-2732x2732-1.png',
    'splash-2732x2732-2.png'
  ];

  for (const variant of variants) {
    const dest = path.join(SPLASH_DIR, variant);
    fs.writeFileSync(dest, splashBuffer);
    console.error(`  Generated ${variant}`);
  }

  // Remove old SVG if we created one previously
  const oldSvg = path.join(SPLASH_DIR, 'splash-2732x2732.svg');
  if (fs.existsSync(oldSvg)) {
    fs.unlinkSync(oldSvg);
  }

  console.error('Splash: 3 splash images generated with dark background (#1a1a2e)');
}

// Main
try {
  console.error('Generating iOS app icons...');
  await generateAppIcon();
  console.error('Generating splash screen images...');
  await generateSplashScreen();
  console.error('Done!');
} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
