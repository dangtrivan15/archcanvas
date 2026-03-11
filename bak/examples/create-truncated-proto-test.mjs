/**
 * Script to create a truncated .archc file for testing Feature #199.
 * Creates a valid .archc file and then truncates it to half its length,
 * simulating a corrupt/incomplete file download or partial disk write.
 *
 * Run with: node examples/create-truncated-proto-test.mjs
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

// Create a sample architecture with enough data that truncation is meaningful
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
  architecture: {
    name: 'Truncation Test Architecture',
    description: 'This file was intentionally truncated to test error handling for incomplete protobuf messages.',
    owners: ['Test User'],
    nodes: [
      {
        id: 'node-alpha',
        type: 'compute/service',
        displayName: 'Alpha Service',
        args: { lang: { stringValue: 'TypeScript' } },
        position: { x: 100, y: 200, width: 240, height: 120 },
      },
      {
        id: 'node-beta',
        type: 'data/database',
        displayName: 'Beta Database',
        args: { engine: { stringValue: 'PostgreSQL' } },
        position: { x: 400, y: 200, width: 240, height: 120 },
      },
    ],
    edges: [
      {
        id: 'edge-ab',
        fromNode: 'node-alpha',
        toNode: 'node-beta',
        type: 0, // SYNC
        label: 'SQL queries',
      },
    ],
  },
};

// Verify and create full file first
const errMsg = ArchCanvasFile.verify(fileData);
if (errMsg) {
  console.error('Verify error:', errMsg);
  process.exit(1);
}

const message = ArchCanvasFile.create(fileData);
const payload = ArchCanvasFile.encode(message).finish();

// Compute SHA-256 of FULL payload (stored in header)
const checksum = createHash('sha256').update(payload).digest();

// Magic bytes: "ARCHC\0"
const MAGIC = Buffer.from([0x41, 0x52, 0x43, 0x48, 0x43, 0x00]);

// Version: uint16 big-endian (version 1)
const VERSION = Buffer.alloc(2);
VERSION.writeUInt16BE(1, 0);

// Assemble FULL valid binary: [magic 6B][version 2B][sha256 32B][protobuf NB]
const fullBinary = Buffer.concat([MAGIC, VERSION, checksum, payload]);

// TRUNCATE to half length (simulates incomplete file)
const halfLength = Math.floor(fullBinary.length / 2);
const truncatedBinary = fullBinary.slice(0, halfLength);

// Write truncated file to public/ directory for browser testing via ?load= URL
const outPath = join(__dirname, '..', 'public', 'truncated-proto.archc');
writeFileSync(outPath, truncatedBinary);

console.log(`Created truncated test file: ${outPath}`);
console.log(`  Full file size: ${fullBinary.length} bytes`);
console.log(`  Truncated size: ${truncatedBinary.length} bytes (${Math.round(truncatedBinary.length / fullBinary.length * 100)}%)`);
console.log(`  Header intact: ${truncatedBinary.length >= 40 ? 'Yes' : 'No'}`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}... (for FULL payload)`);
console.log(`  Payload truncated: ${fullBinary.length - 40} bytes → ${truncatedBinary.length - 40} bytes`);
