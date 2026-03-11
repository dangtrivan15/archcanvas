/**
 * Script to create a test .archc file with code refs of different roles.
 * Verifies that each code ref shows its role as a colored badge.
 * Run with: node examples/create-coderef-roles-test.mjs
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import protobuf from 'protobufjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the .proto schema directly
const root = await protobuf.load(join(__dirname, '..', 'proto', 'archcanvas.proto'));
const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');

// CodeRefRole enum values from proto:
// SOURCE = 0, API_SPEC = 1, SCHEMA = 2, DEPLOYMENT = 3, CONFIG = 4, TEST = 5

const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
  architecture: {
    name: 'Code Ref Roles Test',
    description: 'Test architecture with code refs having different roles',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-service',
        type: 'compute/service',
        displayName: 'Auth Service',
        args: { language: { stringValue: 'TypeScript' }, framework: { stringValue: 'Express' } },
        position: { x: 200, y: 200, width: 240, height: 120 },
        codeRefs: [
          { path: 'src/auth/handler.ts', role: 0 },       // SOURCE
          { path: 'api/auth-spec.yaml', role: 1 },         // API_SPEC
          { path: 'schema/auth.sql', role: 2 },            // SCHEMA
          { path: 'deploy/auth-service.yaml', role: 3 },   // DEPLOYMENT
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

// Write directly to public dir for Vite serving
const outPath = join(__dirname, '..', 'public', 'coderef-roles-test.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 1 (Auth Service with 4 code refs)`);
console.log(`  Code refs: source, api-spec, schema, deployment`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
