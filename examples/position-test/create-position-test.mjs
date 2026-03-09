/**
 * Creates a test .archc file with specific node positions for position persistence testing.
 * Root nodes at specific coordinates + nested children at specific coordinates.
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

// We need to use the project's proto compilation
const __dirname = dirname(fileURLToPath(import.meta.url));

// Import proto from the compiled output
const protoPath = join(__dirname, '../../src/proto/archcanvas.ts');

// Use protobufjs directly
import protobuf from 'protobufjs';

const root = await protobuf.load(join(__dirname, '../../proto/archcanvas.proto'));
const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');

const file = ArchCanvasFile.create({
  header: {
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
  architecture: {
    name: 'Position Test Architecture',
    description: 'Tests position persistence through save/reload',
    owners: ['tester'],
    nodes: [
      {
        id: 'frontend',
        type: 'client/web-app',
        displayName: 'Frontend App',
        position: { x: 100, y: 50, width: 240, height: 120 },
        children: [
          {
            id: 'react-ui',
            type: 'compute/service',
            displayName: 'React UI',
            position: { x: 20, y: 30, width: 240, height: 100 },
            children: [],
          },
          {
            id: 'state-mgmt',
            type: 'compute/service',
            displayName: 'State Manager',
            position: { x: 320, y: 30, width: 240, height: 100 },
            children: [],
          },
        ],
      },
      {
        id: 'backend',
        type: 'compute/service',
        displayName: 'Backend Server',
        position: { x: 500, y: 50, width: 240, height: 120 },
        children: [
          {
            id: 'api-handler',
            type: 'compute/service',
            displayName: 'API Handler',
            position: { x: 10, y: 20, width: 240, height: 100 },
            children: [],
          },
          {
            id: 'auth-module',
            type: 'security/auth-provider',
            displayName: 'Auth Module',
            position: { x: 300, y: 20, width: 240, height: 100 },
            children: [],
          },
          {
            id: 'data-layer',
            type: 'data/database',
            displayName: 'Data Layer',
            position: { x: 150, y: 180, width: 240, height: 100 },
            children: [],
          },
        ],
      },
      {
        id: 'database',
        type: 'data/database',
        displayName: 'PostgreSQL',
        position: { x: 300, y: 300, width: 240, height: 120 },
        children: [],
      },
    ],
    edges: [
      {
        id: 'edge-fe-be',
        fromNode: 'frontend',
        toNode: 'backend',
        type: 0,
        label: 'REST API',
      },
      {
        id: 'edge-be-db',
        fromNode: 'backend',
        toNode: 'database',
        type: 0,
        label: 'SQL',
      },
    ],
  },
});

const payload = ArchCanvasFile.encode(file).finish();

// Build .archc binary: [magic 6B][version 2B][sha256 32B][protobuf NB]
const magic = Buffer.from([0x41, 0x52, 0x43, 0x48, 0x43, 0x00]); // "ARCHC\0"
const version = Buffer.alloc(2);
version.writeUInt16BE(1, 0);

const hash = createHash('sha256').update(payload).digest();

const binary = Buffer.concat([magic, version, hash, payload]);

const outDir = join(__dirname);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'position-test.archc'), binary);
console.log(`Created position-test.archc (${binary.length} bytes)`);
console.log('Root nodes:');
console.log('  Frontend App: (100, 50)');
console.log('  Backend Server: (500, 50)');
console.log('  PostgreSQL: (300, 300)');
console.log('Children of Frontend:');
console.log('  React UI: (20, 30)');
console.log('  State Manager: (320, 30)');
console.log('Children of Backend:');
console.log('  API Handler: (10, 20)');
console.log('  Auth Module: (300, 20)');
console.log('  Data Layer: (150, 180)');
