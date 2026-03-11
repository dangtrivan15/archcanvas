/**
 * Script to create a test .archc file where A is the only root node.
 * A has child B, B has child C. Deleting A should leave zero nodes.
 * Run with: node examples/create-recursive-delete-only-root.mjs
 */

import { writeFileSync, mkdirSync, copyFileSync } from 'fs';
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
    name: 'Only Root Delete Test',
    description: 'A is the only root node with B and C nested inside',
    owners: ['Test'],
    nodes: [
      {
        id: 'node-A',
        type: 'compute/service',
        displayName: 'Parent A',
        args: {
          language: { stringValue: 'TypeScript' },
        },
        position: { x: 200, y: 150, width: 300, height: 250 },
        children: [
          {
            id: 'node-B',
            type: 'compute/service',
            displayName: 'Child B',
            args: {
              language: { stringValue: 'Python' },
            },
            position: { x: 20, y: 40, width: 260, height: 160 },
            children: [
              {
                id: 'node-C',
                type: 'compute/function',
                displayName: 'Grandchild C',
                args: {
                  runtime: { stringValue: 'Node.js' },
                },
                position: { x: 20, y: 40, width: 200, height: 80 },
              },
            ],
          },
        ],
      },
    ],
    edges: [],
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

const outDir = join(__dirname, 'recursive-delete');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'only-root-delete-test.archc');
writeFileSync(outPath, result);

const publicPath = join(__dirname, '..', 'public', 'only-root-delete-test.archc');
copyFileSync(outPath, publicPath);

console.log(`Created test file: ${outPath}`);
console.log(`Copied to: ${publicPath}`);
console.log(`  File size: ${result.length} bytes`);
console.log(`  Nodes: 1 root (A) with nested B>C`);
console.log(`  Edges: 0`);
