#!/usr/bin/env node
/**
 * Standalone bridge server entry point.
 *
 * Runs the AI bridge as an independent HTTP + WebSocket server,
 * decoupled from Vite. Used by the Tauri sidecar for desktop mode.
 *
 * Usage: node dist/bridge-server.js [--port <port>] [--cwd <path>]
 */

import { createBridgeServer } from '../core/ai/bridgeServer.js';

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const cwdIdx = args.indexOf('--cwd');

const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 17248;
const cwd = cwdIdx !== -1 ? args[cwdIdx + 1] : process.cwd();

const server = createBridgeServer({ port, cwd });
const { port: actualPort } = await server.start();

// Structured first line for Tauri sidecar port discovery
console.log(`BRIDGE_PORT=${actualPort}`);

process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
