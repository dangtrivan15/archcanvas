/**
 * Vite Bridge Plugin
 *
 * Integrates the Claude Code bridge server (PTY + WebSocket) directly into
 * the Vite dev server. When `npm run dev` starts, the bridge WebSocket
 * endpoint is automatically available at ws://<host>:<port>/bridge.
 *
 * This eliminates the need for a separate `npm run bridge` process.
 *
 * Architecture:
 *   Browser <--WebSocket (ws://<host>:<port>/bridge)--> Vite Plugin <--stdin/stdout--> Claude Code CLI
 */
import type { Plugin } from 'vite';
/** Path for the bridge WebSocket endpoint on the Vite dev server */
export declare const BRIDGE_WS_PATH = "/bridge";
export interface ViteBridgePluginOptions {
    /** Path to the .archc file for the MCP server (optional) */
    archcFile?: string;
    /** Enable/disable the bridge plugin (default: true) */
    enabled?: boolean;
}
/**
 * Vite plugin that sets up the Claude Code bridge WebSocket on the dev server.
 *
 * Uses the Vite `configureServer` hook to attach a WebSocketServer to the
 * existing Vite HTTP server, handling upgrades on the `/bridge` path.
 */
export declare function viteBridgePlugin(options?: ViteBridgePluginOptions): Plugin;
//# sourceMappingURL=viteBridgePlugin.d.ts.map