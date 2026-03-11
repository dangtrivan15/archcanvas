/**
 * Script to create a test .archc file with pending AI suggestion notes.
 * Used for verifying Feature #130: Accept AI suggestion changes note status.
 * Run with: node examples/create-suggestion-test.mjs
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

// Create architecture with a node that has pending suggestion notes
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: now,
    updatedAtMs: now,
  },
  architecture: {
    name: 'Suggestion Test Architecture',
    description: 'Test architecture for verifying Accept/Dismiss suggestion workflow',
    owners: ['Test Team'],
    nodes: [
      {
        id: 'node-api-gateway',
        type: 'compute/service',
        displayName: 'API Gateway',
        position: { x: 100, y: 100, width: 240, height: 120 },
        notes: [
          {
            id: 'note-suggestion-1',
            author: 'ai',
            timestampMs: now - 60000,
            content: 'Consider adding rate limiting to protect against DDoS attacks. You could use a token bucket algorithm with configurable limits per client.',
            tags: ['security', 'performance'],
            status: 1, // PENDING
            suggestionType: 'security',
          },
          {
            id: 'note-suggestion-2',
            author: 'ai',
            timestampMs: now - 30000,
            content: 'Add health check endpoint at /health for load balancer integration.',
            tags: ['architecture'],
            status: 1, // PENDING
            suggestionType: 'architecture',
          },
          {
            id: 'note-regular-1',
            author: 'user',
            timestampMs: now - 120000,
            content: 'This is the main entry point for all API requests.',
            tags: ['documentation'],
            status: 0, // NONE (regular note)
          },
        ],
        args: {
          port: { numberValue: 8080 },
          framework: { stringValue: 'Express' },
        },
      },
      {
        id: 'node-user-service',
        type: 'compute/service',
        displayName: 'User Service',
        position: { x: 500, y: 100, width: 240, height: 120 },
        notes: [
          {
            id: 'note-suggestion-3',
            author: 'ai',
            timestampMs: now - 15000,
            content: 'Implement caching for user profile lookups to reduce database load.',
            tags: ['performance'],
            status: 1, // PENDING
            suggestionType: 'performance',
          },
        ],
      },
    ],
    edges: [
      {
        id: 'edge-api-user',
        fromNode: 'node-api-gateway',
        toNode: 'node-user-service',
        type: 0, // SYNC
        label: 'REST',
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
const outDir = join(__dirname, 'suggestion-test');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'suggestion-test.archc');
writeFileSync(outPath, result);

// Also copy to public for loading via URL
const publicPath = join(__dirname, '..', 'public', 'suggestion-test.archc');
writeFileSync(publicPath, result);

console.log(`Created suggestion test file: ${outPath}`);
console.log(`Also copied to: ${publicPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 2 (API Gateway with 3 notes, User Service with 1 note)`);
console.log(`  Pending suggestions: 3`);
console.log(`  Regular notes: 1`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
