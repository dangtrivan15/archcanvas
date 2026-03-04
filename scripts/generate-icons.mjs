/**
 * Generate ArchCanvas app icons for PWA.
 * Creates simple but professional-looking icons using Node.js canvas (via sharp or raw PNG).
 *
 * Since we don't have a canvas library, we'll generate SVGs and convert to PNG using sharp
 * or create minimal valid PNG files programmatically.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(__dirname, '../public/icons');

// Ensure directory exists
mkdirSync(ICONS_DIR, { recursive: true });

/**
 * Create an SVG icon for ArchCanvas.
 * Design: Dark background (#1a1a2e) with a stylized "A" formed by
 * connected graph nodes, representing architecture + canvas.
 */
function createIconSVG(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : 0;
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;

  // Scale factor relative to 512px base
  const s = innerSize / 512;

  // Node positions forming an abstract "A" / graph shape
  const nodes = [
    { x: cx, y: cy - 160 * s, r: 28 * s, color: '#60a5fa' },         // Top node (blue)
    { x: cx - 120 * s, y: cy + 40 * s, r: 24 * s, color: '#34d399' }, // Bottom-left (green)
    { x: cx + 120 * s, y: cy + 40 * s, r: 24 * s, color: '#34d399' }, // Bottom-right (green)
    { x: cx, y: cy + 140 * s, r: 20 * s, color: '#a78bfa' },          // Bottom center (purple)
  ];

  // Edges connecting nodes
  const edges = [
    { from: 0, to: 1 },  // Top to bottom-left
    { from: 0, to: 2 },  // Top to bottom-right
    { from: 1, to: 3 },  // Bottom-left to bottom-center
    { from: 2, to: 3 },  // Bottom-right to bottom-center
    { from: 1, to: 2 },  // Cross connection
  ];

  const bgColor = '#1a1a2e';
  const edgeColor = 'rgba(148, 163, 184, 0.6)';
  const edgeWidth = 3 * s;
  const cornerRadius = maskable ? size * 0.2 : size * 0.15;

  let edgePaths = '';
  for (const edge of edges) {
    const from = nodes[edge.from];
    const to = nodes[edge.to];
    edgePaths += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${edgeColor}" stroke-width="${edgeWidth}" stroke-linecap="round"/>`;
  }

  let nodePaths = '';
  for (const node of nodes) {
    // Outer glow
    nodePaths += `<circle cx="${node.x}" cy="${node.y}" r="${node.r + 4 * s}" fill="${node.color}" opacity="0.3"/>`;
    // Inner circle
    nodePaths += `<circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="${node.color}"/>`;
    // Highlight
    nodePaths += `<circle cx="${node.x - node.r * 0.25}" cy="${node.y - node.r * 0.25}" r="${node.r * 0.35}" fill="rgba(255,255,255,0.25)"/>`;
  }

  // "AC" text at bottom
  const fontSize = 48 * s;
  const textY = cy + 140 * s + 56 * s;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${bgColor}"/>
  ${edgePaths}
  ${nodePaths}
</svg>`;
}

/**
 * Convert SVG to PNG using a simple approach.
 * We'll save SVGs and also try to create PNGs via a spawned process.
 */
const sizes = [180, 192, 512];

for (const size of sizes) {
  // Standard icon
  const svg = createIconSVG(size, false);
  const svgPath = resolve(ICONS_DIR, `icon-${size}x${size}.svg`);
  writeFileSync(svgPath, svg);
  console.log(`Created: icon-${size}x${size}.svg`);

  // Maskable icon (with padding for safe zone)
  const maskableSvg = createIconSVG(size, true);
  const maskableSvgPath = resolve(ICONS_DIR, `icon-maskable-${size}x${size}.svg`);
  writeFileSync(maskableSvgPath, maskableSvg);
  console.log(`Created: icon-maskable-${size}x${size}.svg`);
}

// Try to convert SVGs to PNGs using sharp if available
async function convertToPng() {
  try {
    const { default: sharp } = await import('sharp');

    for (const size of sizes) {
      // Standard
      const svgBuffer = Buffer.from(createIconSVG(size, false));
      await sharp(svgBuffer).resize(size, size).png().toFile(resolve(ICONS_DIR, `icon-${size}x${size}.png`));
      console.log(`Converted: icon-${size}x${size}.png`);

      // Maskable
      const maskableSvgBuffer = Buffer.from(createIconSVG(size, true));
      await sharp(maskableSvgBuffer).resize(size, size).png().toFile(resolve(ICONS_DIR, `icon-maskable-${size}x${size}.png`));
      console.log(`Converted: icon-maskable-${size}x${size}.png`);
    }
  } catch (e) {
    console.log('sharp not available, SVGs created. Use a tool to convert SVGs to PNGs.');
    console.log('Alternatively, the manifest can reference SVG icons directly.');
  }
}

await convertToPng();
console.log('Icon generation complete!');
