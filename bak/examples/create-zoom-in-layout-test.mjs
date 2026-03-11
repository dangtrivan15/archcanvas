/**
 * Script to create a test .archc file for verifying auto-layout on zoom-in.
 * Creates a parent "Backend Server" with 4 children at (0,0) positions.
 * When zooming into the parent, auto-layout should trigger automatically.
 * Run with: node examples/create-zoom-in-layout-test.mjs
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
    name: 'Zoom-In Layout Test',
    description: 'Tests auto-layout triggers on zoom-in when children lack positions',
    owners: ['Test'],
    nodes: [
      {
        id: 'backend',
        type: 'compute/service',
        displayName: 'Backend Server',
        args: {
          language: { stringValue: 'Java' },
          framework: { stringValue: 'Spring Boot' },
        },
        position: { x: 100, y: 100, width: 300, height: 200 },
        children: [
          {
            id: 'auth-controller',
            type: 'compute/service',
            displayName: 'Auth Controller',
            args: {},
            position: { x: 0, y: 0, width: 240, height: 100 }, // default - needs layout
            children: [],
            codeRefs: [],
            notes: [],
            properties: {},
          },
          {
            id: 'user-controller',
            type: 'compute/service',
            displayName: 'User Controller',
            args: {},
            position: { x: 0, y: 0, width: 240, height: 100 }, // default - needs layout
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
            position: { x: 0, y: 0, width: 240, height: 100 }, // default - needs layout
            children: [],
            codeRefs: [],
            notes: [],
            properties: {},
          },
          {
            id: 'user-repo',
            type: 'data/repository',
            displayName: 'User Repository',
            args: {},
            position: { x: 0, y: 0, width: 240, height: 100 }, // default - needs layout
            children: [],
            codeRefs: [],
            notes: [],
            properties: {},
          },
        ],
        codeRefs: [],
        notes: [],
        properties: {},
      },
      {
        id: 'frontend',
        type: 'client/web-app',
        displayName: 'React Frontend',
        args: {
          framework: { stringValue: 'React' },
        },
        position: { x: 500, y: 100, width: 240, height: 100 },
        children: [],
        codeRefs: [],
        notes: [],
        properties: {},
      },
      {
        id: 'database',
        type: 'data/database',
        displayName: 'PostgreSQL',
        args: {
          engine: { stringValue: 'PostgreSQL' },
        },
        position: { x: 900, y: 100, width: 240, height: 100 },
        children: [],
        codeRefs: [],
        notes: [],
        properties: {},
      },
    ],
    edges: [
      {
        id: 'edge-fe-be',
        fromNode: 'frontend',
        toNode: 'backend',
        type: 0,
        label: 'API calls',
      },
      {
        id: 'edge-be-db',
        fromNode: 'backend',
        toNode: 'database',
        type: 2,
        label: 'queries',
      },
      {
        id: 'edge-auth-ctrl-auth-svc',
        fromNode: 'auth-controller',
        toNode: 'auth-service',
        type: 0,
        label: 'delegates to',
      },
      {
        id: 'edge-user-ctrl-user-repo',
        fromNode: 'user-controller',
        toNode: 'user-repo',
        type: 0,
        label: 'uses',
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

const outPath = join(__dirname, '..', 'public', 'zoom-in-layout-test.archc');
writeFileSync(outPath, result);

console.log(`Created test file: ${outPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Root nodes: 3 (Backend Server, React Frontend, PostgreSQL)`);
console.log(`  Backend children: 4 (ALL at position 0,0 - needs auto-layout on zoom-in)`);
console.log(`  Root edges: 2, Child edges: 2`);
