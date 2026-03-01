/**
 * Script to create a test .archc file for verifying the File Open feature.
 * Run with: node examples/create-test-file.mjs
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

// Create a sample architecture
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
  architecture: {
    name: 'E-Commerce Platform',
    description: 'A sample e-commerce system architecture for testing',
    owners: ['Team Alpha'],
    nodes: [
      {
        id: 'node-api-gateway',
        type: 'compute/api-gateway',
        displayName: 'API Gateway',
        args: { port: { numberValue: 8080 } },
        position: { x: 100, y: 200, width: 240, height: 120 },
      },
      {
        id: 'node-order-service',
        type: 'compute/service',
        displayName: 'Order Service',
        args: {
          language: { stringValue: 'TypeScript' },
          framework: { stringValue: 'Express' },
        },
        position: { x: 450, y: 100, width: 240, height: 120 },
      },
      {
        id: 'node-user-service',
        type: 'compute/service',
        displayName: 'User Service',
        args: {
          language: { stringValue: 'Go' },
        },
        position: { x: 450, y: 300, width: 240, height: 120 },
      },
      {
        id: 'node-orders-db',
        type: 'data/database',
        displayName: 'Orders Database',
        args: {
          engine: { stringValue: 'PostgreSQL' },
          version: { stringValue: '16' },
        },
        position: { x: 800, y: 100, width: 240, height: 120 },
      },
      {
        id: 'node-users-db',
        type: 'data/database',
        displayName: 'Users Database',
        args: {
          engine: { stringValue: 'MongoDB' },
        },
        position: { x: 800, y: 300, width: 240, height: 120 },
      },
    ],
    edges: [
      {
        id: 'edge-gw-orders',
        fromNode: 'node-api-gateway',
        toNode: 'node-order-service',
        type: 0, // SYNC
        label: 'REST',
      },
      {
        id: 'edge-gw-users',
        fromNode: 'node-api-gateway',
        toNode: 'node-user-service',
        type: 0, // SYNC
        label: 'REST',
      },
      {
        id: 'edge-orders-db',
        fromNode: 'node-order-service',
        toNode: 'node-orders-db',
        type: 2, // DATA_FLOW
        label: 'SQL',
      },
      {
        id: 'edge-users-db',
        fromNode: 'node-user-service',
        toNode: 'node-users-db',
        type: 2, // DATA_FLOW
        label: 'MongoDB Wire',
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
const outPath = join(__dirname, 'ecommerce', 'ecommerce.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 5`);
console.log(`  Edges: 4`);
console.log(`  Checksum: ${checksum.toString('hex').slice(0, 16)}...`);
