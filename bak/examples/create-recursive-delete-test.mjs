/**
 * Script to create a test .archc file for verifying recursive node deletion.
 * Creates node A with child B, and B has child C.
 * Also creates an external node D with an edge from C to D.
 * Run with: node examples/create-recursive-delete-test.mjs
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

// Create architecture with nested nodes: A > B > C, plus external D
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: now,
    updatedAtMs: now,
  },
  architecture: {
    name: 'Recursive Delete Test',
    description: 'Tests recursive deletion of parent with nested children',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-A',
        type: 'compute/service',
        displayName: 'Parent A',
        args: {
          language: { stringValue: 'TypeScript' },
        },
        position: { x: 100, y: 100, width: 300, height: 250 },
        children: [
          {
            id: 'node-B',
            type: 'compute/service',
            displayName: 'Child B',
            args: {
              language: { stringValue: 'Python' },
            },
            position: { x: 20, y: 40, width: 260, height: 160 },
            children: [
              {
                id: 'node-C',
                type: 'compute/function',
                displayName: 'Grandchild C',
                args: {
                  runtime: { stringValue: 'Node.js' },
                },
                position: { x: 20, y: 40, width: 200, height: 80 },
              },
            ],
          },
        ],
      },
      {
        id: 'node-D',
        type: 'data/database',
        displayName: 'External DB',
        args: {
          engine: { stringValue: 'PostgreSQL' },
        },
        position: { x: 500, y: 150, width: 240, height: 120 },
      },
    ],
    edges: [
      {
        id: 'edge-A-D',
        fromNode: 'node-A',
        toNode: 'node-D',
        type: 0, // SYNC
        label: 'queries',
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

// Write to examples directory
const outDir = join(__dirname, 'recursive-delete');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'recursive-delete-test.archc');
writeFileSync(outPath, result);

// Also copy to public/ for URL loading
const publicPath = join(__dirname, '..', 'public', 'recursive-delete-test.archc');
copyFileSync(outPath, publicPath);

console.log(`Created test file: ${outPath}`);
console.log(`Copied to: ${publicPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 2 root (A with B>C nested, D external)`);
console.log(`  Edges: 1 (A -> D)`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
