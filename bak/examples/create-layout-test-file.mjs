/**
 * Script to create a test .archc file for verifying auto-layout horizontal direction.
 * Creates 4 nodes in a chain: A → B → C → D with positions scattered randomly.
 * After applying horizontal layout, nodes should flow left-to-right.
 * Run with: node examples/create-layout-test-file.mjs
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import protobuf from 'protobufjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the .proto schema directly
const root = await protobuf.load(join(__dirname, '..', 'proto', 'archcanvas.proto'));
const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');

const now = Date.now();

// Create 4 connected nodes with SCATTERED positions (not left-to-right)
// After horizontal auto-layout, they should be rearranged to flow left-to-right
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: now,
    updatedAtMs: now,
  },
  architecture: {
    name: 'Layout Test Architecture',
    description: 'Tests for horizontal auto-layout direction',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-a',
        type: 'compute/api-gateway',
        displayName: 'Gateway A',
        args: {
          port: { numberValue: 8080 },
        },
        position: { x: 500, y: 400, width: 240, height: 100 }, // Scattered: far right and bottom
      },
      {
        id: 'node-b',
        type: 'compute/service',
        displayName: 'Service B',
        args: {
          language: { stringValue: 'TypeScript' },
        },
        position: { x: 100, y: 50, width: 240, height: 100 }, // Scattered: top left
      },
      {
        id: 'node-c',
        type: 'compute/service',
        displayName: 'Service C',
        args: {
          language: { stringValue: 'Go' },
        },
        position: { x: 600, y: 100, width: 240, height: 100 }, // Scattered: top right
      },
      {
        id: 'node-d',
        type: 'data/database',
        displayName: 'Database D',
        args: {
          engine: { stringValue: 'PostgreSQL' },
        },
        position: { x: 50, y: 300, width: 240, height: 100 }, // Scattered: bottom left
      },
    ],
    edges: [
      {
        id: 'edge-a-b',
        fromNode: 'node-a',
        toNode: 'node-b',
        fromPort: 'route-out',
        toPort: 'http-in',
        type: 0, // SYNC
        label: 'routes to',
      },
      {
        id: 'edge-b-c',
        fromNode: 'node-b',
        toNode: 'node-c',
        fromPort: 'http-out',
        toPort: 'http-in',
        type: 0, // SYNC
        label: 'calls',
      },
      {
        id: 'edge-c-d',
        fromNode: 'node-c',
        toNode: 'node-d',
        fromPort: 'http-out',
        toPort: 'query-in',
        type: 2, // DATA_FLOW
        label: 'writes to',
      },
    ],
  },
  canvasState: {
    viewport: { x: 0, y: 0, zoom: 1.0 },
  },
};

// Verify and create
const errMsg = ArchCanvasFile.verify(fileData);
if (errMsg) {
  console.error('Verify error:', errMsg);
  process.exit(1);
}

const message = ArchCanvasFile.create(fileData);
const payload = ArchCanvasFile.encode(message).finish();

// Compute SHA-256 of payload
const checksum = createHash('sha256').update(payload).digest();

// Magic bytes: "ARCHC\0"
const MAGIC = Buffer.from([0x41, 0x52, 0x43, 0x48, 0x43, 0x00]);

// Version: uint16 big-endian (version 1)
const VERSION = Buffer.alloc(2);
VERSION.writeUInt16BE(1, 0);

// Assemble: [magic 6B][version 2B][sha256 32B][protobuf NB]
const result = Buffer.concat([MAGIC, VERSION, checksum, payload]);

// Write to public dir for URL loading
const outPath = join(__dirname, '..', 'public', 'layout-test.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 4 (Gateway A → Service B → Service C → Database D)`);
console.log(`  Edges: 3 (A→B, B→C, C→D)`);
console.log(`  Initial positions: SCATTERED (not in order)`);
console.log(`  After horizontal layout: should flow left-to-right`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
