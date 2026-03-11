/**
 * Script to create a test .archc file with an unknown/unregistered node type.
 * This verifies that GenericNode renders as a fallback for unregistered types.
 * Run with: node examples/create-unknown-type-file.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import protobuf from 'protobufjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the .proto schema directly
const root = await protobuf.load(join(__dirname, '..', 'proto', 'archcanvas.proto'));
const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');

// Create architecture with both known and unknown type nodes
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
  architecture: {
    name: 'Unknown Type Test',
    description: 'Test architecture with unknown/unregistered node types',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-known-service',
        type: 'compute/service',
        displayName: 'Known Service',
        args: { language: { stringValue: 'TypeScript' } },
        position: { x: 100, y: 200, width: 240, height: 120 },
      },
      {
        id: 'node-custom-unknown',
        type: 'custom/unknown',
        displayName: 'Custom Unknown Widget',
        args: { flavor: { stringValue: 'experimental' } },
        position: { x: 450, y: 200, width: 240, height: 120 },
      },
      {
        id: 'node-weird-type',
        type: 'bizarre/nonexistent-thing',
        displayName: 'Bizarre Node',
        args: {},
        position: { x: 800, y: 200, width: 240, height: 120 },
      },
    ],
    edges: [
      {
        id: 'edge-known-to-unknown',
        fromNode: 'node-known-service',
        toNode: 'node-custom-unknown',
        type: 0, // SYNC
        label: 'connects',
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

// Write to file (in a subdir so it can be served by Vite public dir)
const outDir = join(__dirname, 'unknown-type');
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}
const outPath = join(outDir, 'unknown-type.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 3 (1 known, 2 unknown types)`);
console.log(`  Edges: 1`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
