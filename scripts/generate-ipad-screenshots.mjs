#!/usr/bin/env node
/**
 * Generate iPad App Store screenshots for ArchCanvas.
 * Creates marketing screenshots at the required iPad dimensions:
 * - 2048x2732 (12.9" iPad Pro portrait)
 * - 2732x2048 (12.9" iPad Pro landscape)
 * - 1668x2388 (11" iPad Pro portrait)
 * - 2388x1668 (11" iPad Pro landscape)
 *
 * Generates 3 screenshots per size:
 * 1. Canvas view - showing architecture nodes
 * 2. Node editing - showing node detail panel
 * 3. AI chat panel - showing chat interface
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppStoreScreenshots');

// ArchCanvas brand colors
const DARK_BG = '#1a1a2e';
const CARD_BG = '#252540';
const ACCENT_BLUE = '#60a5fa';
const ACCENT_GREEN = '#34d399';
const ACCENT_PURPLE = '#a78bfa';
const ACCENT_AMBER = '#fbbf24';
const TEXT_WHITE = '#e2e8f0';
const TEXT_MUTED = '#94a3b8';
const BORDER_COLOR = '#334155';

/**
 * Create an SVG for the canvas view screenshot
 */
function canvasViewSvg(w, h) {
  const toolbarH = Math.round(h * 0.06);
  const statusH = Math.round(h * 0.035);
  const sidebarW = Math.round(w * 0.18);
  const nodeW = Math.round(w * 0.14);
  const nodeH = Math.round(h * 0.12);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="shadow" x="-4%" y="-4%" width="108%" height="108%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.3"/>
    </filter>
    <linearGradient id="topbar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d2d4a"/>
      <stop offset="100%" stop-color="#1e1e36"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${w}" height="${h}" fill="${DARK_BG}"/>

  <!-- Grid pattern -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="1" fill="rgba(100,116,139,0.2)"/>
  </pattern>
  <rect x="${sidebarW}" y="${toolbarH}" width="${w - sidebarW}" height="${h - toolbarH - statusH}" fill="url(#grid)"/>

  <!-- Toolbar -->
  <rect width="${w}" height="${toolbarH}" fill="url(#topbar)"/>
  <text x="${Math.round(w * 0.03)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, -apple-system, sans-serif" font-size="${Math.round(toolbarH * 0.4)}" font-weight="700" fill="${TEXT_WHITE}">ArchCanvas</text>
  <text x="${Math.round(w * 0.15)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.3)}" fill="${TEXT_MUTED}">File</text>
  <text x="${Math.round(w * 0.22)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.3)}" fill="${TEXT_MUTED}">Add Node</text>
  <text x="${Math.round(w * 0.32)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.3)}" fill="${TEXT_MUTED}">Connect</text>
  <text x="${Math.round(w * 0.41)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.3)}" fill="${TEXT_MUTED}">Layout</text>
  <text x="${Math.round(w * 0.50)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.35)}" fill="${TEXT_WHITE}">E-Commerce Platform</text>

  <!-- Sidebar -->
  <rect x="0" y="${toolbarH}" width="${sidebarW}" height="${h - toolbarH - statusH}" fill="${CARD_BG}" opacity="0.95"/>
  <line x1="${sidebarW}" y1="${toolbarH}" x2="${sidebarW}" y2="${h - statusH}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <text x="${Math.round(sidebarW * 0.1)}" y="${Math.round(toolbarH + h * 0.04)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.018)}" font-weight="600" fill="${TEXT_WHITE}">Node Types</text>

  <!-- Sidebar items -->
  ${['COMPUTE', 'Service', 'Function', 'Worker', 'DATA', 'Database', 'Cache', 'MESSAGING', 'Message Queue'].map((item, i) => {
    const isCategory = item === item.toUpperCase();
    const y = Math.round(toolbarH + h * 0.06 + i * h * 0.035);
    if (isCategory) {
      return `<text x="${Math.round(sidebarW * 0.1)}" y="${y}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.013)}" font-weight="700" fill="${ACCENT_BLUE}" letter-spacing="1">${item}</text>`;
    }
    return `<rect x="${Math.round(sidebarW * 0.06)}" y="${Math.round(y - h * 0.02)}" width="${Math.round(sidebarW * 0.88)}" height="${Math.round(h * 0.03)}" rx="4" fill="rgba(96,165,250,0.08)"/>
    <text x="${Math.round(sidebarW * 0.15)}" y="${y}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.015)}" fill="${TEXT_WHITE}">${item}</text>`;
  }).join('\n  ')}

  <!-- Canvas nodes -->
  <!-- API Gateway -->
  ${nodeBox(Math.round(w * 0.45), Math.round(h * 0.15), nodeW, nodeH, 'API Gateway', 'compute/api-gateway', ACCENT_BLUE, h)}

  <!-- Service -->
  ${nodeBox(Math.round(w * 0.30), Math.round(h * 0.40), nodeW, nodeH, 'Order Service', 'compute/service', ACCENT_BLUE, h)}

  <!-- Database (cylinder) -->
  ${cylinderNode(Math.round(w * 0.55), Math.round(h * 0.40), nodeW, nodeH, 'PostgreSQL', 'data/database', ACCENT_GREEN, h)}

  <!-- Worker -->
  ${nodeBox(Math.round(w * 0.30), Math.round(h * 0.65), nodeW, nodeH, 'Email Worker', 'compute/worker', ACCENT_PURPLE, h)}

  <!-- Message Queue -->
  ${queueNode(Math.round(w * 0.55), Math.round(h * 0.65), nodeW, nodeH, 'RabbitMQ', 'messaging/queue', ACCENT_AMBER, h)}

  <!-- CDN -->
  ${cloudNode(Math.round(w * 0.72), Math.round(h * 0.20), nodeW, Math.round(nodeH * 0.8), 'CloudFront', 'network/cdn', ACCENT_GREEN, h)}

  <!-- Object Storage -->
  ${nodeBox(Math.round(w * 0.72), Math.round(h * 0.50), nodeW, nodeH, 'S3 Bucket', 'data/object-storage', ACCENT_GREEN, h)}

  <!-- Edges -->
  ${edge(Math.round(w * 0.52), Math.round(h * 0.15 + nodeH), Math.round(w * 0.37), Math.round(h * 0.40))}
  ${edge(Math.round(w * 0.52), Math.round(h * 0.15 + nodeH), Math.round(w * 0.62), Math.round(h * 0.40))}
  ${edge(Math.round(w * 0.37), Math.round(h * 0.40 + nodeH), Math.round(w * 0.37), Math.round(h * 0.65))}
  ${edge(Math.round(w * 0.37), Math.round(h * 0.40 + nodeH), Math.round(w * 0.62), Math.round(h * 0.65))}
  ${edge(Math.round(w * 0.52 + nodeW), Math.round(h * 0.15 + nodeH * 0.5), Math.round(w * 0.72), Math.round(h * 0.20 + nodeH * 0.4))}
  ${edge(Math.round(w * 0.62 + nodeW * 0.5), Math.round(h * 0.40 + nodeH), Math.round(w * 0.79), Math.round(h * 0.50))}

  <!-- Status bar -->
  <rect y="${h - statusH}" width="${w}" height="${statusH}" fill="#16162b"/>
  <text x="${Math.round(w * 0.02)}" y="${Math.round(h - statusH * 0.3)}" font-family="monospace" font-size="${Math.round(statusH * 0.4)}" fill="${ACCENT_GREEN}">NORMAL</text>
  <text x="${Math.round(w * 0.12)}" y="${Math.round(h - statusH * 0.3)}" font-family="monospace" font-size="${Math.round(statusH * 0.35)}" fill="${TEXT_MUTED}">Root  ·  Nodes: 7  ·  Edges: 6  ·  Zoom: 100%</text>
  <text x="${Math.round(w * 0.75)}" y="${Math.round(h - statusH * 0.3)}" font-family="monospace" font-size="${Math.round(statusH * 0.35)}" fill="${ACCENT_GREEN}">✓ Saved</text>
</svg>`;
}

/**
 * Create an SVG for the node editing screenshot
 */
function nodeEditSvg(w, h) {
  const toolbarH = Math.round(h * 0.06);
  const statusH = Math.round(h * 0.035);
  const panelW = Math.round(w * 0.32);
  const nodeW = Math.round(w * 0.12);
  const nodeH = Math.round(h * 0.10);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="topbar2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d2d4a"/>
      <stop offset="100%" stop-color="#1e1e36"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${w}" height="${h}" fill="${DARK_BG}"/>
  <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="1" fill="rgba(100,116,139,0.2)"/>
  </pattern>
  <rect x="0" y="${toolbarH}" width="${w - panelW}" height="${h - toolbarH - statusH}" fill="url(#grid2)"/>

  <!-- Toolbar -->
  <rect width="${w}" height="${toolbarH}" fill="url(#topbar2)"/>
  <text x="${Math.round(w * 0.03)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.4)}" font-weight="700" fill="${TEXT_WHITE}">ArchCanvas</text>
  <text x="${Math.round(w * 0.50)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.35)}" fill="${TEXT_WHITE}">E-Commerce Platform</text>

  <!-- Selected node on canvas (highlighted) -->
  ${nodeBox(Math.round(w * 0.25), Math.round(h * 0.30), nodeW, nodeH, 'Order Service', 'compute/service', ACCENT_BLUE, h, true)}
  ${cylinderNode(Math.round(w * 0.45), Math.round(h * 0.30), nodeW, nodeH, 'PostgreSQL', 'data/database', ACCENT_GREEN, h)}
  ${nodeBox(Math.round(w * 0.25), Math.round(h * 0.55), nodeW, nodeH, 'Email Worker', 'compute/worker', ACCENT_PURPLE, h)}

  ${edge(Math.round(w * 0.32 + nodeW * 0.5), Math.round(h * 0.30 + nodeH), Math.round(w * 0.32), Math.round(h * 0.55))}
  ${edge(Math.round(w * 0.25 + nodeW), Math.round(h * 0.30 + nodeH * 0.5), Math.round(w * 0.45), Math.round(h * 0.30 + nodeH * 0.5))}

  <!-- Right detail panel -->
  <rect x="${w - panelW}" y="${toolbarH}" width="${panelW}" height="${h - toolbarH - statusH}" fill="${CARD_BG}"/>
  <line x1="${w - panelW}" y1="${toolbarH}" x2="${w - panelW}" y2="${h - statusH}" stroke="${BORDER_COLOR}" stroke-width="1"/>

  <!-- Panel header -->
  <text x="${Math.round(w - panelW + panelW * 0.06)}" y="${Math.round(toolbarH + h * 0.04)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.022)}" font-weight="700" fill="${TEXT_WHITE}">Order Service</text>
  <text x="${Math.round(w - panelW + panelW * 0.06)}" y="${Math.round(toolbarH + h * 0.065)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.014)}" fill="${ACCENT_BLUE}">compute/service</text>

  <!-- Tabs -->
  ${['Properties', 'Code', 'Notes', 'AI'].map((tab, i) => {
    const tx = Math.round(w - panelW + panelW * (0.06 + i * 0.24));
    const ty = Math.round(toolbarH + h * 0.10);
    const isActive = i === 0;
    return `<text x="${tx}" y="${ty}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.014)}" fill="${isActive ? ACCENT_BLUE : TEXT_MUTED}" font-weight="${isActive ? '600' : '400'}">${tab}</text>
    ${isActive ? `<line x1="${tx}" y1="${Math.round(ty + h * 0.008)}" x2="${Math.round(tx + panelW * 0.15)}" y2="${Math.round(ty + h * 0.008)}" stroke="${ACCENT_BLUE}" stroke-width="2"/>` : ''}`;
  }).join('\n  ')}

  <!-- Properties form -->
  ${formField(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.14), Math.round(panelW * 0.88), 'Display Name', 'Order Service', h)}
  ${formField(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.22), Math.round(panelW * 0.88), 'Language', 'TypeScript', h)}
  ${formField(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.30), Math.round(panelW * 0.88), 'Framework', 'Express', h)}
  ${formField(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.38), Math.round(panelW * 0.88), 'Replicas', '3', h)}
  ${formField(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.46), Math.round(panelW * 0.88), 'Health Check', '/health', h)}

  <!-- Ports section -->
  <text x="${Math.round(w - panelW + panelW * 0.06)}" y="${Math.round(toolbarH + h * 0.56)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.016)}" font-weight="600" fill="${TEXT_WHITE}">Ports</text>
  ${portBadge(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.58), 'http-in', ACCENT_GREEN, h)}
  ${portBadge(Math.round(w - panelW + panelW * 0.30), Math.round(toolbarH + h * 0.58), 'grpc-in', ACCENT_GREEN, h)}
  ${portBadge(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.62), 'http-out', ACCENT_AMBER, h)}
  ${portBadge(Math.round(w - panelW + panelW * 0.30), Math.round(toolbarH + h * 0.62), 'grpc-out', ACCENT_AMBER, h)}

  <!-- Code refs -->
  <text x="${Math.round(w - panelW + panelW * 0.06)}" y="${Math.round(toolbarH + h * 0.69)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.016)}" font-weight="600" fill="${TEXT_WHITE}">Code References</text>
  ${codeRef(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.72), Math.round(panelW * 0.88), 'src/services/order.ts', 'SOURCE', h)}
  ${codeRef(Math.round(w - panelW + panelW * 0.06), Math.round(toolbarH + h * 0.76), Math.round(panelW * 0.88), 'src/api/orders.yaml', 'API_SPEC', h)}

  <!-- Status bar -->
  <rect y="${h - statusH}" width="${w}" height="${statusH}" fill="#16162b"/>
  <text x="${Math.round(w * 0.02)}" y="${Math.round(h - statusH * 0.3)}" font-family="monospace" font-size="${Math.round(statusH * 0.4)}" fill="${ACCENT_BLUE}">EDIT</text>
  <text x="${Math.round(w * 0.10)}" y="${Math.round(h - statusH * 0.3)}" font-family="monospace" font-size="${Math.round(statusH * 0.35)}" fill="${TEXT_MUTED}">Order Service  ·  Nodes: 7  ·  Edges: 6  ·  Zoom: 85%</text>
</svg>`;
}

/**
 * Create an SVG for the AI chat panel screenshot
 */
function aiChatSvg(w, h) {
  const toolbarH = Math.round(h * 0.06);
  const statusH = Math.round(h * 0.035);
  const panelW = Math.round(w * 0.35);
  const nodeW = Math.round(w * 0.11);
  const nodeH = Math.round(h * 0.09);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="topbar3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d2d4a"/>
      <stop offset="100%" stop-color="#1e1e36"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${w}" height="${h}" fill="${DARK_BG}"/>
  <pattern id="grid3" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="1" fill="rgba(100,116,139,0.2)"/>
  </pattern>
  <rect x="0" y="${toolbarH}" width="${w - panelW}" height="${h - toolbarH - statusH}" fill="url(#grid3)"/>

  <!-- Toolbar -->
  <rect width="${w}" height="${toolbarH}" fill="url(#topbar3)"/>
  <text x="${Math.round(w * 0.03)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.4)}" font-weight="700" fill="${TEXT_WHITE}">ArchCanvas</text>
  <text x="${Math.round(w * 0.45)}" y="${Math.round(toolbarH * 0.65)}" font-family="system-ui, sans-serif" font-size="${Math.round(toolbarH * 0.35)}" fill="${TEXT_WHITE}">E-Commerce Platform</text>

  <!-- Canvas nodes (dimmed slightly) -->
  ${nodeBox(Math.round(w * 0.12), Math.round(h * 0.25), nodeW, nodeH, 'API Gateway', 'compute/api-gw', ACCENT_BLUE, h)}
  ${nodeBox(Math.round(w * 0.30), Math.round(h * 0.25), nodeW, nodeH, 'Order Svc', 'compute/service', ACCENT_BLUE, h)}
  ${cylinderNode(Math.round(w * 0.30), Math.round(h * 0.48), nodeW, nodeH, 'PostgreSQL', 'data/db', ACCENT_GREEN, h)}
  ${nodeBox(Math.round(w * 0.48), Math.round(h * 0.25), nodeW, nodeH, 'Worker', 'compute/worker', ACCENT_PURPLE, h)}

  ${edge(Math.round(w * 0.12 + nodeW), Math.round(h * 0.25 + nodeH * 0.5), Math.round(w * 0.30), Math.round(h * 0.25 + nodeH * 0.5))}
  ${edge(Math.round(w * 0.36), Math.round(h * 0.25 + nodeH), Math.round(w * 0.36), Math.round(h * 0.48))}
  ${edge(Math.round(w * 0.30 + nodeW), Math.round(h * 0.25 + nodeH * 0.5), Math.round(w * 0.48), Math.round(h * 0.25 + nodeH * 0.5))}

  <!-- Right AI chat panel -->
  <rect x="${w - panelW}" y="${toolbarH}" width="${panelW}" height="${h - toolbarH - statusH}" fill="${CARD_BG}"/>
  <line x1="${w - panelW}" y1="${toolbarH}" x2="${w - panelW}" y2="${h - statusH}" stroke="${BORDER_COLOR}" stroke-width="1"/>

  <!-- Chat header -->
  <rect x="${w - panelW}" y="${toolbarH}" width="${panelW}" height="${Math.round(h * 0.05)}" fill="#2a2a48"/>
  <text x="${Math.round(w - panelW + panelW * 0.06)}" y="${Math.round(toolbarH + h * 0.033)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.018)}" font-weight="600" fill="${TEXT_WHITE}">AI Assistant</text>
  <circle cx="${Math.round(w - panelW + panelW * 0.88)}" cy="${Math.round(toolbarH + h * 0.025)}" r="${Math.round(h * 0.008)}" fill="${ACCENT_GREEN}"/>

  <!-- Chat messages -->
  ${chatMessage(Math.round(w - panelW + panelW * 0.04), Math.round(toolbarH + h * 0.07), Math.round(panelW * 0.85), 'user', 'How should I split the Order Service for better scalability?', h)}

  ${chatMessage(Math.round(w - panelW + panelW * 0.04), Math.round(toolbarH + h * 0.18), Math.round(panelW * 0.85), 'assistant', 'I suggest decomposing Order Service into three microservices:\\n\\n1. **Order API** - handles HTTP requests\\n2. **Order Processor** - business logic\\n3. **Payment Gateway** - payment handling\\n\\nThis follows the single-responsibility principle and allows independent scaling.', h)}

  <!-- Suggestion card -->
  <rect x="${Math.round(w - panelW + panelW * 0.04)}" y="${Math.round(toolbarH + h * 0.52)}" width="${Math.round(panelW * 0.92)}" height="${Math.round(h * 0.12)}" rx="8" fill="rgba(96,165,250,0.1)" stroke="${ACCENT_BLUE}" stroke-width="1" stroke-opacity="0.3"/>
  <text x="${Math.round(w - panelW + panelW * 0.08)}" y="${Math.round(toolbarH + h * 0.55)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.013)}" fill="${ACCENT_BLUE}" font-weight="600">💡 Suggestion: Add 3 new nodes</text>
  <text x="${Math.round(w - panelW + panelW * 0.08)}" y="${Math.round(toolbarH + h * 0.575)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.012)}" fill="${TEXT_MUTED}">Split Order Service → Order API + Order Processor + Payment GW</text>

  <!-- Accept/Dismiss buttons -->
  <rect x="${Math.round(w - panelW + panelW * 0.08)}" y="${Math.round(toolbarH + h * 0.60)}" width="${Math.round(panelW * 0.25)}" height="${Math.round(h * 0.03)}" rx="4" fill="${ACCENT_GREEN}" opacity="0.9"/>
  <text x="${Math.round(w - panelW + panelW * 0.13)}" y="${Math.round(toolbarH + h * 0.62)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.013)}" fill="white" font-weight="600">✓ Accept</text>
  <rect x="${Math.round(w - panelW + panelW * 0.38)}" y="${Math.round(toolbarH + h * 0.60)}" width="${Math.round(panelW * 0.25)}" height="${Math.round(h * 0.03)}" rx="4" fill="transparent" stroke="${TEXT_MUTED}" stroke-width="1"/>
  <text x="${Math.round(w - panelW + panelW * 0.43)}" y="${Math.round(toolbarH + h * 0.62)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.013)}" fill="${TEXT_MUTED}">✕ Dismiss</text>

  <!-- Chat input -->
  <rect x="${Math.round(w - panelW + panelW * 0.04)}" y="${Math.round(h - statusH - h * 0.07)}" width="${Math.round(panelW * 0.92)}" height="${Math.round(h * 0.045)}" rx="8" fill="#1e1e36" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <text x="${Math.round(w - panelW + panelW * 0.08)}" y="${Math.round(h - statusH - h * 0.04)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.014)}" fill="${TEXT_MUTED}">Ask about your architecture...</text>
  <circle cx="${Math.round(w - panelW + panelW * 0.90)}" cy="${Math.round(h - statusH - h * 0.047)}" r="${Math.round(h * 0.015)}" fill="${ACCENT_BLUE}"/>
  <text x="${Math.round(w - panelW + panelW * 0.886)}" y="${Math.round(h - statusH - h * 0.04)}" font-family="system-ui, sans-serif" font-size="${Math.round(h * 0.016)}" fill="white">↑</text>

  <!-- Status bar -->
  <rect y="${h - statusH}" width="${w}" height="${statusH}" fill="#16162b"/>
  <text x="${Math.round(w * 0.02)}" y="${Math.round(h - statusH * 0.3)}" font-family="monospace" font-size="${Math.round(statusH * 0.4)}" fill="${ACCENT_GREEN}">NORMAL</text>
  <text x="${Math.round(w * 0.10)}" y="${Math.round(h - statusH * 0.3)}" font-family="monospace" font-size="${Math.round(statusH * 0.35)}" fill="${TEXT_MUTED}">Root  ·  Nodes: 7  ·  Edges: 6  ·  AI: Claude 3.5</text>
</svg>`;
}

// Helper functions
function nodeBox(x, y, w, h, name, type, color, totalH, selected = false) {
  const fs1 = Math.round(totalH * 0.014);
  const fs2 = Math.round(totalH * 0.011);
  const strip = Math.round(h * 0.06);
  return `<g filter="url(#shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#2a2a48" stroke="${selected ? ACCENT_BLUE : BORDER_COLOR}" stroke-width="${selected ? 2 : 1}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${strip}" rx="8" fill="${color}" opacity="0.8"/>
    <rect x="${x}" y="${Math.round(y + strip * 0.6)}" width="${w}" height="${Math.round(strip * 0.5)}" fill="#2a2a48"/>
    <text x="${Math.round(x + w * 0.08)}" y="${Math.round(y + h * 0.35)}" font-family="system-ui, sans-serif" font-size="${fs1}" font-weight="600" fill="${TEXT_WHITE}">${name}</text>
    <text x="${Math.round(x + w * 0.08)}" y="${Math.round(y + h * 0.55)}" font-family="system-ui, sans-serif" font-size="${fs2}" fill="${TEXT_MUTED}">${type}</text>
  </g>`;
}

function cylinderNode(x, y, w, h, name, type, color, totalH) {
  const fs1 = Math.round(totalH * 0.014);
  const fs2 = Math.round(totalH * 0.011);
  const ry = Math.round(h * 0.08);
  return `<g filter="url(#shadow)">
    <ellipse cx="${Math.round(x + w / 2)}" cy="${y + ry}" rx="${Math.round(w / 2)}" ry="${ry}" fill="${color}" opacity="0.3"/>
    <rect x="${x}" y="${y + ry}" width="${w}" height="${Math.round(h - ry * 2)}" fill="#2a2a48" stroke="${BORDER_COLOR}" stroke-width="1"/>
    <ellipse cx="${Math.round(x + w / 2)}" cy="${y + ry}" rx="${Math.round(w / 2)}" ry="${ry}" fill="${color}" opacity="0.6"/>
    <ellipse cx="${Math.round(x + w / 2)}" cy="${Math.round(y + h - ry)}" rx="${Math.round(w / 2)}" ry="${ry}" fill="#2a2a48" stroke="${BORDER_COLOR}" stroke-width="1"/>
    <text x="${Math.round(x + w * 0.08)}" y="${Math.round(y + h * 0.45)}" font-family="system-ui, sans-serif" font-size="${fs1}" font-weight="600" fill="${TEXT_WHITE}">${name}</text>
    <text x="${Math.round(x + w * 0.08)}" y="${Math.round(y + h * 0.65)}" font-family="system-ui, sans-serif" font-size="${fs2}" fill="${TEXT_MUTED}">${type}</text>
  </g>`;
}

function queueNode(x, y, w, h, name, type, color, totalH) {
  const fs1 = Math.round(totalH * 0.014);
  const fs2 = Math.round(totalH * 0.011);
  return `<g filter="url(#shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#2a2a48" stroke="${BORDER_COLOR}" stroke-width="1"/>
    <rect x="${x}" y="${y}" width="${w}" height="${Math.round(h * 0.06)}" rx="8" fill="${color}" opacity="0.8"/>
    <text x="${Math.round(x + w * 0.08)}" y="${Math.round(y + h * 0.35)}" font-family="system-ui, sans-serif" font-size="${fs1}" font-weight="600" fill="${TEXT_WHITE}">${name}</text>
    <text x="${Math.round(x + w * 0.08)}" y="${Math.round(y + h * 0.55)}" font-family="system-ui, sans-serif" font-size="${fs2}" fill="${TEXT_MUTED}">${type}</text>
  </g>`;
}

function cloudNode(x, y, w, h, name, type, color, totalH) {
  const fs1 = Math.round(totalH * 0.014);
  const fs2 = Math.round(totalH * 0.011);
  return `<g filter="url(#shadow)">
    <ellipse cx="${Math.round(x + w / 2)}" cy="${Math.round(y + h / 2)}" rx="${Math.round(w * 0.55)}" ry="${Math.round(h * 0.5)}" fill="#2a2a48" stroke="${BORDER_COLOR}" stroke-width="1"/>
    <ellipse cx="${Math.round(x + w / 2)}" cy="${Math.round(y + h * 0.2)}" rx="${Math.round(w * 0.3)}" ry="${Math.round(h * 0.2)}" fill="${color}" opacity="0.2"/>
    <text x="${Math.round(x + w * 0.15)}" y="${Math.round(y + h * 0.45)}" font-family="system-ui, sans-serif" font-size="${fs1}" font-weight="600" fill="${TEXT_WHITE}">${name}</text>
    <text x="${Math.round(x + w * 0.15)}" y="${Math.round(y + h * 0.65)}" font-family="system-ui, sans-serif" font-size="${fs2}" fill="${TEXT_MUTED}">${type}</text>
  </g>`;
}

function edge(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(148,163,184,0.4)" stroke-width="2" stroke-linecap="round"/>`;
}

function formField(x, y, w, label, value, totalH) {
  const fs1 = Math.round(totalH * 0.013);
  const fs2 = Math.round(totalH * 0.014);
  const fieldH = Math.round(totalH * 0.035);
  return `<text x="${x}" y="${y}" font-family="system-ui, sans-serif" font-size="${fs1}" fill="${TEXT_MUTED}">${label}</text>
  <rect x="${x}" y="${Math.round(y + totalH * 0.01)}" width="${w}" height="${fieldH}" rx="4" fill="#1e1e36" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <text x="${Math.round(x + w * 0.04)}" y="${Math.round(y + totalH * 0.01 + fieldH * 0.65)}" font-family="system-ui, sans-serif" font-size="${fs2}" fill="${TEXT_WHITE}">${value}</text>`;
}

function portBadge(x, y, label, color, totalH) {
  const fs = Math.round(totalH * 0.012);
  const w = Math.round(label.length * fs * 0.7 + 16);
  return `<rect x="${x}" y="${y}" width="${w}" height="${Math.round(totalH * 0.025)}" rx="4" fill="${color}" opacity="0.15"/>
  <text x="${Math.round(x + 8)}" y="${Math.round(y + totalH * 0.018)}" font-family="monospace" font-size="${fs}" fill="${color}">${label}</text>`;
}

function codeRef(x, y, w, path, role, totalH) {
  const fs = Math.round(totalH * 0.012);
  return `<rect x="${x}" y="${y}" width="${w}" height="${Math.round(totalH * 0.03)}" rx="4" fill="rgba(96,165,250,0.08)"/>
  <text x="${Math.round(x + 8)}" y="${Math.round(y + totalH * 0.02)}" font-family="monospace" font-size="${fs}" fill="${ACCENT_BLUE}">${path}</text>
  <text x="${Math.round(x + w * 0.75)}" y="${Math.round(y + totalH * 0.02)}" font-family="monospace" font-size="${Math.round(fs * 0.85)}" fill="${TEXT_MUTED}">${role}</text>`;
}

function chatMessage(x, y, w, role, text, totalH) {
  const isUser = role === 'user';
  const fs = Math.round(totalH * 0.013);
  const lines = text.split('\\n');
  const lineHeight = Math.round(totalH * 0.02);
  const msgH = Math.round(lines.length * lineHeight + totalH * 0.03);
  const bgColor = isUser ? 'rgba(96,165,250,0.12)' : 'rgba(52,211,153,0.08)';
  const labelColor = isUser ? ACCENT_BLUE : ACCENT_GREEN;
  const label = isUser ? 'You' : 'Claude';

  return `<rect x="${x}" y="${y}" width="${w}" height="${msgH}" rx="8" fill="${bgColor}"/>
  <text x="${Math.round(x + w * 0.03)}" y="${Math.round(y + totalH * 0.018)}" font-family="system-ui, sans-serif" font-size="${Math.round(fs * 0.9)}" font-weight="600" fill="${labelColor}">${label}</text>
  ${lines.map((line, i) => {
    const ly = Math.round(y + totalH * 0.035 + i * lineHeight);
    const isBold = line.includes('**');
    const cleanLine = line.replace(/\*\*/g, '');
    return `<text x="${Math.round(x + w * 0.03)}" y="${ly}" font-family="system-ui, sans-serif" font-size="${fs}" fill="${TEXT_WHITE}" font-weight="${isBold ? '600' : '400'}">${cleanLine}</text>`;
  }).join('\n  ')}`;
}

// iPad screenshot dimensions
const IPAD_SIZES = [
  { name: '12.9-inch-portrait', width: 2048, height: 2732 },
  { name: '11-inch-portrait', width: 1668, height: 2388 },
];

const SCREENSHOT_TYPES = [
  { suffix: 'canvas-view', generator: canvasViewSvg, desc: 'Canvas View' },
  { suffix: 'node-editing', generator: nodeEditSvg, desc: 'Node Editing' },
  { suffix: 'ai-chat', generator: aiChatSvg, desc: 'AI Chat Panel' },
];

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let generated = 0;

  for (const size of IPAD_SIZES) {
    for (const type of SCREENSHOT_TYPES) {
      const filename = `iPad-${size.name}-${type.suffix}.png`;
      const dest = path.join(OUT_DIR, filename);
      const svg = type.generator(size.width, size.height);
      const svgBuffer = Buffer.from(svg);

      await sharp(svgBuffer, { density: 72 })
        .resize(size.width, size.height)
        .png({ quality: 95 })
        .toFile(dest);

      const stats = fs.statSync(dest);
      console.error(`  Generated ${filename} (${Math.round(stats.size / 1024)}KB)`);
      generated++;
    }
  }

  console.error(`\nApp Store Screenshots: ${generated} images generated in ${OUT_DIR}`);
}

try {
  console.error('Generating iPad App Store screenshots...');
  await main();
  console.error('Done!');
} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
