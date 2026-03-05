/**
 * Protobufjs/minimal ESM compatibility wrapper.
 *
 * The auto-generated archcanvas.pb.js uses:
 *   import * as $protobuf from "protobufjs/minimal"
 *
 * This works in Vite (which handles CJS→ESM interop), but fails in
 * Node.js ESM (tsx) because CJS modules only expose a `default` export.
 *
 * This wrapper provides a proper ESM module that works in both environments.
 * It imports protobufjs/minimal and re-exports it as a namespace.
 */

import protobufMinimal from 'protobufjs/minimal';

// In Vite, the namespace import already has named exports.
// In Node.js ESM (tsx), they're under .default.
// This normalizes the difference.
const protobuf =
  (protobufMinimal as { default?: typeof protobufMinimal }).default ?? protobufMinimal;

export const Reader = protobuf.Reader;
export const Writer = protobuf.Writer;
export const util = protobuf.util;
export const roots = protobuf.roots;
export const rpc = protobuf.rpc;
export const configure = protobuf.configure;

export default protobuf;
