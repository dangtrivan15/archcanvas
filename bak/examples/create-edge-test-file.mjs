/**
 * Script to create a test .archc file with 4 nodes and NO edges.
 * Used for testing edge creation and visual style verification.
 * Run with: node examples/create-edge-test-file.mjs
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

// Create architecture with 4 nodes in a 2x2 grid, NO edges
const fileData = {
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
  architecture: {
    name: 'Edge Style Test',
    description: 'Test file for verifying edge visual styles',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-a',
        type: 'compute/service',
        displayName: 'Node A',
        args: { role: { stringValue: 'sync-source' } },
        position: { x: 100, y: 100, width: 200, height: 100 },
      },
      {
        id: 'node-b',
        type: 'compute/service',
        displayName: 'Node B',
        args: { role: { stringValue: 'sync-target' } },
        position: { x: 500, y: 100, width: 200, height: 100 },
      },
      {
        id: 'node-c',
        type: 'compute/service',
        displayName: 'Node C',
        args: { role: { stringValue: 'async-source' } },
        position: { x: 100, y: 300, width: 200, height: 100 },
      },
      {
        id: 'node-d',
        type: 'data/database',
        displayName: 'Node D',
        args: { engine: { stringValue: 'PostgreSQL' } },
        position: { x: 500, y: 300, width: 200, height: 100 },
      },
    ],
    edges: [],  // No edges - we'll create them via UI
  },
  canvasState: {
    viewport: { x: 0, y: 0, zoom: 1.0 },
  },
};

// Encode the file
const errMsg = ArchCanvasFile.verify(fileData);
if (errMsg) throw new Error(`Proto verification failed: ${errMsg}`);
const message = ArchCanvasFile.create(fileData);
const payload = ArchCanvasFile.encode(message).finish();

// Create binary file with magic bytes
const MAGIC = Buffer.from([0x41, 0x52, 0x43, 0x48, 0x43, 0x00]);
const VERSION = Buffer.alloc(2);
VERSION.writeUInt16BE(1, 0);
const checksum = createHash('sha256').update(payload).digest();

// Assemble: [magic 6B][version 2B][sha256 32B][protobuf NB]
const fileBuffer = Buffer.concat([MAGIC, VERSION, checksum, payload]);

// Write to public/ for URL loading
const outputPath = join(__dirname, '..', 'public', 'edge-test.archc');
writeFileSync(outputPath, fileBuffer);
console.log(`Created: ${outputPath} (${fileBuffer.length} bytes)`);
console.log('Load with: http://localhost:5174/?load=edge-test.archc');
