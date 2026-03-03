/**
 * Generate a test .archc file with 100 nodes for performance testing.
 * Creates a realistic architecture with multiple services, databases, caches, and messaging.
 *
 * Usage: node scripts/generate-100-nodes.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import protobuf from 'protobufjs';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const protoPath = resolve(__dirname, '../proto/archcanvas.proto');

// Node type rotation for variety
const nodeTypes = [
  'compute/service',
  'data/database',
  'data/cache',
  'messaging/event-bus',
  'messaging/message-queue',
  'compute/api-gateway',
  'network/load-balancer',
  'observability/logging',
  'observability/monitoring',
  'data/object-storage',
];

// Display name prefixes per type
const typeNames = {
  'compute/service': ['User', 'Order', 'Payment', 'Auth', 'Notification', 'Inventory', 'Shipping', 'Search', 'Analytics', 'Report'],
  'data/database': ['Users', 'Orders', 'Products', 'Sessions', 'Payments', 'Inventory', 'Logs', 'Events', 'Configs', 'Analytics'],
  'data/cache': ['Session', 'Product', 'User', 'Config', 'Rate-Limit', 'API', 'Search', 'Token', 'Feed', 'Leaderboard'],
  'messaging/event-bus': ['Domain', 'Integration', 'System', 'User', 'Order'],
  'messaging/message-queue': ['Email', 'SMS', 'Push', 'Webhook', 'Export'],
  'compute/api-gateway': ['Public', 'Internal', 'Partner', 'Mobile', 'Admin'],
  'network/load-balancer': ['Frontend', 'API', 'Microservice', 'WebSocket', 'gRPC'],
  'observability/logging': ['App', 'Access', 'Error', 'Audit', 'Security'],
  'observability/monitoring': ['Infra', 'App', 'Business', 'SLA', 'Cost'],
  'data/object-storage': ['Media', 'Backup', 'Export', 'Upload', 'Archive'],
};

// Suffix per type
const typeSuffix = {
  'compute/service': 'Service',
  'data/database': 'DB',
  'data/cache': 'Cache',
  'messaging/event-bus': 'Event Bus',
  'messaging/message-queue': 'Queue',
  'compute/api-gateway': 'Gateway',
  'network/load-balancer': 'LB',
  'observability/logging': 'Logger',
  'observability/monitoring': 'Monitor',
  'data/object-storage': 'Storage',
};

async function main() {
  // Load proto schema
  const root = await protobuf.load(protoPath);
  const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');
  const Architecture = root.lookupType('archcanvas.Architecture');
  const NodeMsg = root.lookupType('archcanvas.Node');
  const EdgeMsg = root.lookupType('archcanvas.Edge');
  const PositionMsg = root.lookupType('archcanvas.Position');
  const FileHeader = root.lookupType('archcanvas.FileHeader');

  const TOTAL_NODES = 100;
  const COLS = 10; // 10 columns x 10 rows grid layout
  const COL_SPACING = 350;
  const ROW_SPACING = 180;

  const nodes = [];
  const nodeIds = [];
  const typeCounters = {};

  for (let i = 0; i < TOTAL_NODES; i++) {
    const type = nodeTypes[i % nodeTypes.length];
    if (!typeCounters[type]) typeCounters[type] = 0;
    const nameIndex = typeCounters[type] % (typeNames[type]?.length || 1);
    const prefix = typeNames[type]?.[nameIndex] || `Node${i}`;
    const suffix = typeSuffix[type] || 'Node';
    typeCounters[type]++;

    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const id = `node-${String(i).padStart(3, '0')}`;
    nodeIds.push(id);

    const node = NodeMsg.create({
      id,
      type,
      displayName: `${prefix} ${suffix}`,
      position: PositionMsg.create({
        x: 50 + col * COL_SPACING,
        y: 50 + row * ROW_SPACING,
        width: 280,
        height: 80,
      }),
      args: {},
      children: [],
      codeRefs: [],
      notes: [],
      properties: {},
    });

    nodes.push(node);
  }

  // Create edges: connect some nodes to form a realistic architecture
  // - Services connect to databases, caches, and queues
  // - API gateways connect to services
  // - Event buses connect between services
  const edges = [];
  let edgeCount = 0;

  for (let i = 0; i < TOTAL_NODES; i++) {
    const type = nodeTypes[i % nodeTypes.length];

    // Services connect to the next database and cache
    if (type === 'compute/service') {
      // Connect to nearest database (type index 1)
      const dbIdx = Math.min(i + 1, TOTAL_NODES - 1);
      if (nodeTypes[dbIdx % nodeTypes.length] === 'data/database') {
        edges.push(EdgeMsg.create({
          id: `edge-${edgeCount++}`,
          fromNode: nodeIds[i],
          toNode: nodeIds[dbIdx],
          type: 0, // SYNC
          label: 'queries',
          notes: [],
          properties: {},
        }));
      }

      // Connect to nearest cache (type index 2)
      const cacheIdx = Math.min(i + 2, TOTAL_NODES - 1);
      if (nodeTypes[cacheIdx % nodeTypes.length] === 'data/cache') {
        edges.push(EdgeMsg.create({
          id: `edge-${edgeCount++}`,
          fromNode: nodeIds[i],
          toNode: nodeIds[cacheIdx],
          type: 0, // SYNC
          label: 'caches',
          notes: [],
          properties: {},
        }));
      }

      // Connect to nearest message queue (type index 4)
      const queueIdx = Math.min(i + 4, TOTAL_NODES - 1);
      if (nodeTypes[queueIdx % nodeTypes.length] === 'messaging/message-queue') {
        edges.push(EdgeMsg.create({
          id: `edge-${edgeCount++}`,
          fromNode: nodeIds[i],
          toNode: nodeIds[queueIdx],
          type: 1, // ASYNC
          label: 'publishes',
          notes: [],
          properties: {},
        }));
      }
    }

    // API gateways connect to services in the same row
    if (type === 'compute/api-gateway') {
      // Connect to the nearest preceding service
      for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
        if (nodeTypes[j % nodeTypes.length] === 'compute/service') {
          edges.push(EdgeMsg.create({
            id: `edge-${edgeCount++}`,
            fromNode: nodeIds[i],
            toNode: nodeIds[j],
            type: 0, // SYNC
            label: 'routes',
            notes: [],
            properties: {},
          }));
          break;
        }
      }
    }
  }

  // Architecture
  const architecture = Architecture.create({
    name: '100-Node Performance Test',
    description: 'Large architecture with 100 nodes for canvas performance testing',
    owners: ['perf-test'],
    nodes,
    edges,
  });

  // File header
  const header = FileHeader.create({
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAt: Date.now().toString(),
    modifiedAt: Date.now().toString(),
  });

  // Full file
  const file = ArchCanvasFile.create({
    header,
    architecture,
  });

  // Encode to protobuf
  const protoBytes = ArchCanvasFile.encode(file).finish();

  // Create binary format: magic + version + sha256 + protobuf
  const magic = Buffer.from('ARCHC\x00');
  const version = Buffer.alloc(2);
  version.writeUInt16BE(1);

  // SHA-256 of protobuf bytes
  const hash = createHash('sha256').update(protoBytes).digest();

  // Combine all parts
  const result = Buffer.concat([magic, version, hash, protoBytes]);

  // Write to public/ for URL loading
  const outPath = resolve(__dirname, '../public/perf-100-nodes.archc');
  writeFileSync(outPath, result);
  console.log(`Generated ${outPath} (${result.length} bytes)`);
  console.log(`  - ${nodes.length} root nodes`);
  console.log(`  - ${edges.length} edges`);
  console.log(`  - Load with: ?load=perf-100-nodes.archc`);
}

main().catch(console.error);
