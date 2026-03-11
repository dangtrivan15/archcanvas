/**
 * Script to create a test .archc file for verifying badge counts in node footer.
 * Creates a node with 2 regular notes, 1 pending suggestion, and 1 code ref.
 * Run with: node examples/create-badges-test-file.mjs
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

// Create an architecture with a node that has badges data
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: now,
    updatedAtMs: now,
  },
  architecture: {
    name: 'Badge Test Architecture',
    description: 'Tests for badge counts in node footer',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-badge-test',
        type: 'compute/service',
        displayName: 'Badge Test Service',
        args: {
          language: { stringValue: 'TypeScript' },
        },
        position: { x: 300, y: 200, width: 240, height: 120 },
        notes: [
          {
            id: 'note-regular-1',
            author: 'developer',
            timestampMs: now - 2000,
            content: 'First regular note for testing',
            status: 0, // NONE
          },
          {
            id: 'note-regular-2',
            author: 'reviewer',
            timestampMs: now - 1000,
            content: 'Second regular note for badge count',
            status: 0, // NONE
          },
          {
            id: 'note-suggestion-1',
            author: 'ai',
            timestampMs: now,
            content: 'AI suggestion: consider adding rate limiting',
            status: 1, // PENDING
            suggestionType: 'enhancement',
          },
        ],
        codeRefs: [
          {
            path: 'src/services/badge-test.ts',
            role: 0, // SOURCE
          },
        ],
      },
      {
        id: 'node-no-badges',
        type: 'data/database',
        displayName: 'Plain Database',
        args: {
          engine: { stringValue: 'PostgreSQL' },
        },
        position: { x: 700, y: 200, width: 240, height: 120 },
      },
    ],
    edges: [
      {
        id: 'edge-test',
        fromNode: 'node-badge-test',
        toNode: 'node-no-badges',
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
const outDir = join(__dirname, 'badges');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'badges-test.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 2`);
console.log(`  Edges: 1`);
console.log(`  Badge Test Node: 2 regular notes, 1 pending suggestion, 1 code ref`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
