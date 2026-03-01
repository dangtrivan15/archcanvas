/**
 * Generate a test .archc file with nested (parent-child) nodes
 * for testing fractal zoom navigation.
 *
 * Usage: node scripts/generate-nested-test.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import protobuf from 'protobufjs';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const protoPath = resolve(__dirname, '../proto/archcanvas.proto');

async function main() {
  // Load proto schema
  const root = await protobuf.load(protoPath);
  const ArchCanvasFile = root.lookupType('archcanvas.ArchCanvasFile');
  const Architecture = root.lookupType('archcanvas.Architecture');
  const NodeMsg = root.lookupType('archcanvas.Node');
  const EdgeMsg = root.lookupType('archcanvas.Edge');
  const PositionMsg = root.lookupType('archcanvas.Position');
  const FileHeader = root.lookupType('archcanvas.FileHeader');

  // Create nodes with children
  const child1 = NodeMsg.create({
    id: 'child-api',
    type: 'compute/service',
    displayName: 'API Layer',
    position: PositionMsg.create({ x: 100, y: 100, width: 200, height: 100 }),
    args: {},
    children: [],
    codeRefs: [],
    notes: [],
    properties: {},
  });

  const child2 = NodeMsg.create({
    id: 'child-auth',
    type: 'compute/service',
    displayName: 'Auth Service',
    position: PositionMsg.create({ x: 400, y: 100, width: 200, height: 100 }),
    args: {},
    children: [],
    codeRefs: [],
    notes: [],
    properties: {},
  });

  // Grandchildren for API Layer (to test deep nesting)
  const grandchild1 = NodeMsg.create({
    id: 'gc-rest',
    type: 'compute/function',
    displayName: 'REST Endpoint',
    position: PositionMsg.create({ x: 100, y: 100, width: 200, height: 100 }),
    args: {},
    children: [],
    codeRefs: [],
    notes: [],
    properties: {},
  });

  const grandchild2 = NodeMsg.create({
    id: 'gc-graphql',
    type: 'compute/function',
    displayName: 'GraphQL Endpoint',
    position: PositionMsg.create({ x: 400, y: 100, width: 200, height: 100 }),
    args: {},
    children: [],
    codeRefs: [],
    notes: [],
    properties: {},
  });

  // Add grandchildren to API Layer
  child1.children = [grandchild1, grandchild2];

  // Parent node (with children)
  const parent = NodeMsg.create({
    id: 'parent-service',
    type: 'compute/service',
    displayName: 'Backend Service',
    position: PositionMsg.create({ x: 100, y: 100, width: 200, height: 100 }),
    args: { language: 'TypeScript', framework: 'Express' },
    children: [child1, child2],
    codeRefs: [],
    notes: [],
    properties: {},
  });

  // Another root-level node without children
  const dbNode = NodeMsg.create({
    id: 'db-node',
    type: 'data/database',
    displayName: 'PostgreSQL DB',
    position: PositionMsg.create({ x: 500, y: 100, width: 200, height: 100 }),
    args: { engine: 'PostgreSQL' },
    children: [],
    codeRefs: [],
    notes: [],
    properties: {},
  });

  // A third root-level node (without children)
  const cacheNode = NodeMsg.create({
    id: 'cache-node',
    type: 'data/cache',
    displayName: 'Redis Cache',
    position: PositionMsg.create({ x: 500, y: 300, width: 200, height: 100 }),
    args: {},
    children: [],
    codeRefs: [],
    notes: [],
    properties: {},
  });

  // Create edges between root-level nodes
  const edge1 = EdgeMsg.create({
    id: 'edge-1',
    fromNode: 'parent-service',
    toNode: 'db-node',
    type: 0, // SYNC
    label: 'queries',
    notes: [],
    properties: {},
  });

  const edge2 = EdgeMsg.create({
    id: 'edge-2',
    fromNode: 'parent-service',
    toNode: 'cache-node',
    type: 1, // ASYNC
    label: 'caches',
    notes: [],
    properties: {},
  });

  // Edge between child nodes (visible when zoomed into parent)
  const childEdge = EdgeMsg.create({
    id: 'child-edge-1',
    fromNode: 'child-api',
    toNode: 'child-auth',
    type: 0, // SYNC
    label: 'authenticates',
    notes: [],
    properties: {},
  });

  // Edge between grandchildren (visible when zoomed into API Layer)
  const gcEdge = EdgeMsg.create({
    id: 'gc-edge-1',
    fromNode: 'gc-rest',
    toNode: 'gc-graphql',
    type: 2, // DATA_FLOW
    label: 'shares schema',
    notes: [],
    properties: {},
  });

  // Architecture
  const architecture = Architecture.create({
    name: 'Nested Test Architecture',
    description: 'Test architecture with nested nodes for fractal zoom testing',
    owners: ['test'],
    nodes: [parent, dbNode, cacheNode],
    edges: [edge1, edge2, childEdge, gcEdge],
  });

  // File header
  const header = FileHeader.create({
    formatVersion: 1,
    toolVersion: '0.1.0',
    createdAt: Date.now().toString(),
    modifiedAt: Date.now().toString(),
  });

  // Full file
  const file = ArchCanvasFile.create({
    header,
    architecture,
  });

  // Encode to protobuf
  const protoBytes = ArchCanvasFile.encode(file).finish();

  // Create binary format: magic + version + sha256 + protobuf
  const magic = Buffer.from('ARCHC\x00');
  const version = Buffer.alloc(2);
  version.writeUInt16BE(1);

  // SHA-256 of protobuf bytes
  const hash = createHash('sha256').update(protoBytes).digest();

  // Combine all parts
  const result = Buffer.concat([magic, version, hash, protoBytes]);

  // Write to public/ for URL loading
  const outPath = resolve(__dirname, '../public/test-nested.archc');
  writeFileSync(outPath, result);
  console.log(`Generated ${outPath} (${result.length} bytes)`);
  console.log(`  - 3 root nodes (Backend Service with 2 children, PostgreSQL DB, Redis Cache)`);
  console.log(`  - API Layer has 2 grandchildren`);
  console.log(`  - Load with: ?load=test-nested.archc`);
}

main().catch(console.error);
