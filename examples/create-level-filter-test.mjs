/**
 * Script to create a test .archc file for verifying level-aware node/edge filtering.
 * Creates: Root level A, B, C. A has children D, E. D has child F.
 * Also creates edges at different levels for Feature #99.
 * Run with: node examples/create-level-filter-test.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import protobuf from 'protobufjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the .proto schema directly
const root = await protobuf.load(join(__dirname, '..', 'proto', 'archcanvas.proto'));
const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');

const now = Date.now();

// Create architecture: A(children: D(child: F), E), B, C
// With edges at root level (A→B, B→C) and child level (D→E)
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: now,
    updatedAtMs: now,
  },
  architecture: {
    name: 'Level Filter Test',
    description: 'Tests for level-aware node and edge filtering',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-A',
        type: 'compute/service',
        displayName: 'Node A',
        position: { x: 100, y: 200, width: 240, height: 120 },
        children: [
          {
            id: 'node-D',
            type: 'compute/service',
            displayName: 'Node D',
            position: { x: 50, y: 50, width: 240, height: 120 },
            children: [
              {
                id: 'node-F',
                type: 'compute/function',
                displayName: 'Node F',
                position: { x: 50, y: 50, width: 200, height: 100 },
              },
            ],
          },
          {
            id: 'node-E',
            type: 'data/database',
            displayName: 'Node E',
            position: { x: 350, y: 50, width: 240, height: 120 },
          },
        ],
      },
      {
        id: 'node-B',
        type: 'compute/service',
        displayName: 'Node B',
        position: { x: 500, y: 100, width: 240, height: 120 },
      },
      {
        id: 'node-C',
        type: 'data/database',
        displayName: 'Node C',
        position: { x: 500, y: 350, width: 240, height: 120 },
      },
    ],
    edges: [
      // Root-level edges
      {
        id: 'edge-A-B',
        fromNode: 'node-A',
        toNode: 'node-B',
        type: 0, // SYNC
        label: 'REST',
      },
      {
        id: 'edge-B-C',
        fromNode: 'node-B',
        toNode: 'node-C',
        type: 2, // DATA_FLOW
        label: 'SQL',
      },
      // Child-level edge (inside A: D→E)
      {
        id: 'edge-D-E',
        fromNode: 'node-D',
        toNode: 'node-E',
        type: 1, // ASYNC
        label: 'Events',
      },
    ],
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

// Write to public directory for direct loading
const outPath = join(__dirname, '..', 'public', 'level-filter-test.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Root nodes: A, B, C`);
console.log(`  A children: D, E`);
console.log(`  D child: F`);
console.log(`  Root edges: A→B (REST), B→C (SQL)`);
console.log(`  Child edge: D→E (Events)`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
