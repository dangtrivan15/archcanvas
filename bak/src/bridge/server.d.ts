/**
 * ArchCanvas Bridge Server - Core Module
 *
 * Core logic for spawning Claude Code CLI processes and managing WebSocket
 * connections for bidirectional streaming. This module is used by the Vite
 * bridge plugin (viteBridgePlugin.ts) to integrate into the dev server.
 *
 * Architecture:
 *   Browser <--WebSocket--> Vite Plugin <--stdin/stdout--> Claude Code CLI
 *
 * The bridge is automatically started when running `npm run dev`.
 * Connect via ws://<host>:<port>/bridge (URL derived from window.location)
 */
import { type Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
/** Result of checking whether the claude CLI is installed and accessible */
export interface ClaudeDetectionResult {
    /** Whether the claude CLI was found on PATH */
    found: boolean;
    /** Version string (e.g. "1.2.3") if found */
    version?: string;
    /** Absolute path to the claude binary */
    path?: string;
    /** Error message if not found */
    error?: string;
}
/**
 * Detect whether the Claude Code CLI is installed and accessible.
 * Uses `which` on macOS/Linux and `where` on Windows to locate the binary.
 * If found, retrieves the version via `claude --version`.
 */
export declare function detectClaudeCode(): ClaudeDetectionResult;
export interface BridgeServerOptions {
    /** Port for the HTTP/WebSocket server (default: 3001) */
    port: number;
    /** Hostname to bind to (default: localhost) */
    host: string;
    /** Path to the .archc file for the MCP server */
    archcFile?: string;
    /** Enable CORS headers (default: true) */
    cors: boolean;
}
/** Message sent from browser to bridge over WebSocket */
export interface BridgeInputMessage {
    type: 'stdin' | 'resize' | 'signal';
    /** Text to write to claude CLI stdin (for type: 'stdin') */
    data?: string;
    /** Terminal dimensions (for type: 'resize') */
    cols?: number;
    rows?: number;
    /** Signal name (for type: 'signal') */
    signal?: 'SIGINT' | 'SIGTERM';
}
/** Message sent from bridge to browser over WebSocket */
export interface BridgeOutputMessage {
    type: 'stdout' | 'stderr' | 'exit' | 'error' | 'ready';
    /** Output data (for type: 'stdout' or 'stderr') */
    data?: string;
    /** Exit code (for type: 'exit') */
    code?: number | null;
    /** Error message (for type: 'error') */
    message?: string;
}
/**
 * Handle a single WebSocket connection.
 * Checks if Claude Code is installed, then spawns a process and pipes data bidirectionally.
 */
export declare function handleConnection(ws: WebSocket, archcFile?: string, detectionResult?: ClaudeDetectionResult): void;
/**
 * Create and return the bridge server (HTTP + WebSocket).
 */
export declare function createBridgeServer(options: BridgeServerOptions): {
    httpServer: HttpServer;
    wss: WebSocketServer;
    claudeDetection: ClaudeDetectionResult;
};
/**
 * Start the bridge server and listen on the configured port.
 */
export declare function startBridgeServer(options: BridgeServerOptions): Promise<HttpServer>;
//# sourceMappingURL=server.d.ts.map