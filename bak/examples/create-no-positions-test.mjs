/**
 * Script to create a test .archc file where all root nodes have position (0,0).
 * Used to verify auto-layout triggers automatically on file open.
 * Run with: node examples/create-no-positions-test.mjs
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import protobuf from 'protobufjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const root = await protobuf.load(join(__dirname, '..', 'proto', 'archcanvas.proto'));
const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');

const now = Date.now();

const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: now,
    updatedAtMs: now,
  },
  architecture: {
    name: 'No Positions Test',
    description: 'All root nodes at (0,0) — should trigger auto-layout on open',
    owners: ['Test'],
    nodes: [
      {
        id: 'api-gateway',
        type: 'compute/service',
        displayName: 'API Gateway',
        args: {},
        position: { x: 0, y: 0, width: 240, height: 100 },
        children: [],
        codeRefs: [],
        notes: [],
        properties: {},
      },
      {
        id: 'auth-service',
        type: 'compute/service',
        displayName: 'Auth Service',
        args: {},
        position: { x: 0, y: 0, width: 240, height: 100 },
        children: [],
        codeRefs: [],
        notes: [],
        properties: {},
      },
      {
        id: 'user-service',
        type: 'compute/service',
        displayName: 'User Service',
        args: {},
        position: { x: 0, y: 0, width: 240, height: 100 },
        children: [],
        codeRefs: [],
        notes: [],
        properties: {},
      },
      {
        id: 'postgres-db',
        type: 'data/database',
        displayName: 'PostgreSQL',
        args: { engine: { stringValue: 'PostgreSQL' } },
        position: { x: 0, y: 0, width: 240, height: 100 },
        children: [],
        codeRefs: [],
        notes: [],
        properties: {},
      },
    ],
    edges: [
      {
        id: 'edge-gw-auth',
        fromNode: 'api-gateway',
        toNode: 'auth-service',
        type: 0, // SYNC
        label: 'authenticates',
      },
      {
        id: 'edge-gw-user',
        fromNode: 'api-gateway',
        toNode: 'user-service',
        type: 0, // SYNC
        label: 'routes to',
      },
      {
        id: 'edge-user-db',
        fromNode: 'user-service',
        toNode: 'postgres-db',
        type: 2, // DATA_FLOW
        label: 'queries',
      },
      {
        id: 'edge-auth-db',
        fromNode: 'auth-service',
        toNode: 'postgres-db',
        type: 2, // DATA_FLOW
        label: 'reads credentials',
      },
    ],
  },
  canvasState: {
    viewport: { x: 0, y: 0, zoom: 1.0 },
  },
};

const errMsg = ArchCanvasFile.verify(fileData);
if (errMsg) {
  console.error('Verify error:', errMsg);
  process.exit(1);
}

const message = ArchCanvasFile.create(fileData);
const payload = ArchCanvasFile.encode(message).finish();

const checksum = createHash('sha256').update(payload).digest();

const MAGIC = Buffer.from([0x41, 0x52, 0x43, 0x48, 0x43, 0x00]);
const VERSION = Buffer.alloc(2);
VERSION.writeUInt16BE(1, 0);

const result = Buffer.concat([MAGIC, VERSION, checksum, payload]);

const outPath = join(__dirname, '..', 'public', 'no-positions-test.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Root nodes: 4 (all at 0,0)`);
console.log(`  Edges: 4`);
console.log(`  Expected: auto-layout should trigger on file open`);
