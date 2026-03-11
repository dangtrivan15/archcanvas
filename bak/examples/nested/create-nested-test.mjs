/**
 * Script to create a nested test .archc file for verifying fractal zoom/breadcrumb navigation.
 * Creates: Root level with "Platform" node that has children, grandchildren, and great-grandchildren.
 * Run with: node examples/nested/create-nested-test.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import protobuf from 'protobufjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the .proto schema directly
const root = await protobuf.load(join(__dirname, '..', '..', 'proto', 'archcanvas.proto'));
const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');

// Create a 4-level architecture: Root > Platform > Backend > OrderService
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
  architecture: {
    name: 'Nested Architecture Test',
    description: 'A test architecture with 4 levels of nesting for breadcrumb navigation testing',
    owners: ['Test Team'],
    nodes: [
      {
        id: 'node-platform',
        type: 'compute/service',
        displayName: 'Platform',
        position: { x: 100, y: 100, width: 240, height: 120 },
        children: [
          {
            id: 'node-backend',
            type: 'compute/service',
            displayName: 'Backend',
            position: { x: 50, y: 50, width: 240, height: 120 },
            children: [
              {
                id: 'node-order-svc',
                type: 'compute/service',
                displayName: 'OrderService',
                position: { x: 50, y: 50, width: 240, height: 120 },
                children: [
                  {
                    id: 'node-order-handler',
                    type: 'compute/function',
                    displayName: 'OrderHandler',
                    position: { x: 50, y: 50, width: 200, height: 100 },
                  },
                ],
              },
              {
                id: 'node-user-svc',
                type: 'compute/service',
                displayName: 'UserService',
                position: { x: 350, y: 50, width: 240, height: 120 },
              },
            ],
          },
          {
            id: 'node-frontend',
            type: 'compute/service',
            displayName: 'Frontend',
            position: { x: 350, y: 50, width: 240, height: 120 },
          },
        ],
      },
      {
        id: 'node-database',
        type: 'data/database',
        displayName: 'Database',
        position: { x: 500, y: 100, width: 240, height: 120 },
      },
    ],
    edges: [
      {
        id: 'edge-platform-db',
        fromNode: 'node-platform',
        toNode: 'node-database',
        type: 2, // DATA_FLOW
        label: 'SQL',
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

// Write to file
const outPath = join(__dirname, 'nested.archc');
writeFileSync(outPath, result);

console.log(`Created nested test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Levels: 4 (Root > Platform > Backend > OrderService > OrderHandler)`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
