/**
 * Script to create a test .archc file with a ref node (refSource set).
 * This verifies that RefNode renders with a reference indicator.
 * Run with: node examples/create-ref-node-file.mjs
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

// Create architecture with a ref node
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
  architecture: {
    name: 'Ref Node Test',
    description: 'Test architecture with ref nodes (refSource set)',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-original-service',
        type: 'compute/service',
        displayName: 'Original Service',
        args: { language: { stringValue: 'Go' } },
        position: { x: 100, y: 200, width: 240, height: 120 },
      },
      {
        id: 'node-ref-to-service',
        type: 'compute/service',
        displayName: 'Service Reference',
        args: {},
        refSource: 'node-original-service',
        position: { x: 500, y: 200, width: 240, height: 120 },
      },
      {
        id: 'node-ref-external',
        type: 'data/database',
        displayName: 'Shared DB Ref',
        args: { engine: { stringValue: 'PostgreSQL' } },
        refSource: 'external://shared-infra/primary-db',
        position: { x: 500, y: 400, width: 240, height: 120 },
      },
    ],
    edges: [
      {
        id: 'edge-orig-to-ref',
        fromNode: 'node-original-service',
        toNode: 'node-ref-to-service',
        type: 0, // SYNC
        label: 'references',
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

// Write directly to public dir for Vite serving
const outPath = join(__dirname, '..', 'public', 'ref-node-test.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 3 (1 original, 2 ref nodes)`);
console.log(`  Edges: 1`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
