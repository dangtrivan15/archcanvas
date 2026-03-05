/**
 * Generate light-mode splash screen variants from the existing dark splash.
 * Extracts the logo from the dark splash and composites onto a light background (#f0f1f3).
 */
import sharp from 'sharp';
import path from 'path';

const SPLASH_DIR = path.resolve('ios/App/App/Assets.xcassets/Splash.imageset');
const SIZE = 2732;
// Light background matching the app's light theme
const LIGHT_BG = { r: 240, g: 241, b: 243, alpha: 255 }; // #f0f1f3

async function main() {
  // The dark splash has a dark background (#1a1a2e area) with logo in center.
  // We extract the logo by making the dark background transparent, then composite on light bg.

  // Strategy: Use the dark splash as-is but replace background color.
  // The logo uses colors that work on both dark and light backgrounds.
  // Create a light background and composite the logo extracted via alpha masking.

  const darkSplash = sharp(path.join(SPLASH_DIR, 'splash-2732x2732.png'));
  const { data, info } = await darkSplash.raw().toBuffer({ resolveWithObject: true });

  // Create new buffer with light background, preserving non-background pixels
  const newData = Buffer.alloc(data.length);
  const darkBgR = 26,
    darkBgG = 26,
    darkBgB = 46; // #1a1a2e
  const tolerance = 30;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2],
      a = data[i + 3];

    // Check if pixel is close to the dark background color
    const dr = Math.abs(r - darkBgR);
    const dg = Math.abs(g - darkBgG);
    const db = Math.abs(b - darkBgB);

    if (dr < tolerance && dg < tolerance && db < tolerance) {
      // Replace with light background
      newData[i] = LIGHT_BG.r;
      newData[i + 1] = LIGHT_BG.g;
      newData[i + 2] = LIGHT_BG.b;
      newData[i + 3] = 255;
    } else {
      // Keep original pixel (logo elements)
      newData[i] = r;
      newData[i + 1] = g;
      newData[i + 2] = b;
      newData[i + 3] = a;
    }
  }

  // Write light splash variants
  const lightSplash = sharp(newData, {
    raw: { width: info.width, height: info.height, channels: info.channels as 4 },
  }).png();

  await lightSplash.toFile(path.join(SPLASH_DIR, 'splash-light-2732x2732.png'));

  // Copy for all 3 scales (1x, 2x, 3x)
  const buf = await sharp(newData, {
    raw: { width: info.width, height: info.height, channels: info.channels as 4 },
  })
    .png()
    .toBuffer();

  await sharp(buf).toFile(path.join(SPLASH_DIR, 'splash-light-2732x2732-1.png'));
  await sharp(buf).toFile(path.join(SPLASH_DIR, 'splash-light-2732x2732-2.png'));

  console.log('Light splash screens generated successfully!');
}

main().catch(console.error);
