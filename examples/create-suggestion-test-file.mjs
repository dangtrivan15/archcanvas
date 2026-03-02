/**
 * Script to create a test .archc file for verifying AI suggestion dismiss functionality.
 * Creates a node with pending suggestion notes that can be accepted or dismissed.
 * Run with: node examples/create-suggestion-test-file.mjs
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

// Create an architecture with nodes that have pending AI suggestions
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: now,
    updatedAtMs: now,
  },
  architecture: {
    name: 'Suggestion Test Architecture',
    description: 'Tests for accepting and dismissing AI suggestions',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-suggestion-test',
        type: 'compute/service',
        displayName: 'Suggestion Test Service',
        args: {
          language: { stringValue: 'TypeScript' },
          framework: { stringValue: 'Express' },
        },
        position: { x: 300, y: 200, width: 240, height: 120 },
        notes: [
          {
            id: 'note-regular-1',
            author: 'developer',
            timestampMs: now - 5000,
            content: 'This is a regular user note',
            status: 0, // NONE
          },
          {
            id: 'note-pending-1',
            author: 'ai',
            timestampMs: now - 3000,
            content: 'AI suggestion: Consider adding rate limiting to protect against abuse',
            status: 1, // PENDING
            suggestionType: 'enhancement',
          },
          {
            id: 'note-pending-2',
            author: 'ai',
            timestampMs: now - 1000,
            content: 'AI suggestion: Add health check endpoint at /health',
            status: 1, // PENDING
            suggestionType: 'feature',
          },
        ],
        codeRefs: [
          {
            path: 'src/services/suggestion-test.ts',
            role: 0, // SOURCE
          },
        ],
      },
    ],
    edges: [],
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
const outDir = join(__dirname, 'suggestion-test');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'suggestion-test.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 1`);
console.log(`  Notes: 1 regular + 2 pending AI suggestions`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
