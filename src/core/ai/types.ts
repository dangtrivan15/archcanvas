// --- Chat Events (server → client) ---

/** Base fields shared by every ChatEvent variant. */
interface ChatEventBase {
  requestId: string;
}

export interface TextEvent extends ChatEventBase {
  type: 'text';
  text: string;
}

export interface ToolCallEvent extends ChatEventBase {
  type: 'tool_call';
  toolName: string;
  args: Record<string, unknown>;
  callId: string;
}

export interface ToolResultEvent extends ChatEventBase {
  type: 'tool_result';
  callId: string;
  output: string;
  isError: boolean;
}

export interface ThinkingEvent extends ChatEventBase {
  type: 'thinking';
  text: string;
}

export interface PermissionRequestEvent extends ChatEventBase {
  type: 'permission_request';
  permissionId: string;
  description: string;
  toolName: string;
}

export interface DoneEvent extends ChatEventBase {
  type: 'done';
}

export interface ErrorEvent extends ChatEventBase {
  type: 'error';
  message: string;
  code?: string;
}

export type ChatEvent =
  | TextEvent
  | ToolCallEvent
  | ToolResultEvent
  | ThinkingEvent
  | PermissionRequestEvent
  | DoneEvent
  | ErrorEvent;

// --- Client Messages (client → server) ---

export interface ChatClientMessage {
  type: 'chat';
  requestId: string;
  message: string;
}

export interface AbortClientMessage {
  type: 'abort';
  requestId: string;
}

export interface LoadHistoryClientMessage {
  type: 'load_history';
}

export interface PermissionResponseClientMessage {
  type: 'permission_response';
  permissionId: string;
  approved: boolean;
}

export type ClientMessage =
  | ChatClientMessage
  | AbortClientMessage
  | LoadHistoryClientMessage
  | PermissionResponseClientMessage;

// --- Conversation ---

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  events?: ChatEvent[];
  timestamp: number;
}

// --- Project Context ---

export interface ProjectContext {
  projectName: string;
  projectDescription?: string;
  currentScope: string;
  projectPath: string;
}

// --- Chat Provider ---

export interface ChatProvider {
  id: string;
  displayName: string;
  available: boolean;
  sendMessage(message: string, context: ProjectContext): AsyncIterable<ChatEvent>;
  loadHistory(): Promise<ChatMessage[]>;
  abort(requestId: string): void;
}
