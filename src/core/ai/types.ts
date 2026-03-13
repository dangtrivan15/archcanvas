// --- Chat Events (server → client) ---

/** Base fields shared by every ChatEvent variant. */
interface ChatEventBase {
  requestId: string;
}

export interface TextEvent extends ChatEventBase {
  type: 'text';
  content: string;
}

export interface ToolCallEvent extends ChatEventBase {
  type: 'tool_call';
  name: string;
  args: Record<string, unknown>;
  id: string;
}

export interface ToolResultEvent extends ChatEventBase {
  type: 'tool_result';
  id: string;
  result: string;
  isError?: boolean;
}

export interface ThinkingEvent extends ChatEventBase {
  type: 'thinking';
  content: string;
}

export interface PermissionRequestEvent extends ChatEventBase {
  type: 'permission_request';
  id: string;
  command: string;
  tool: string;
}

export interface DoneEvent extends ChatEventBase {
  type: 'done';
}

export interface ChatErrorEvent extends ChatEventBase {
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
  | ChatErrorEvent;

// --- Client Messages (client → server) ---

export interface ChatClientMessage {
  type: 'chat';
  requestId: string;
  content: string;
  context: ProjectContext;
}

export interface AbortClientMessage {
  type: 'abort';
}

export interface LoadHistoryClientMessage {
  type: 'load_history';
  messages: ChatMessage[];
}

export interface PermissionResponseClientMessage {
  type: 'permission_response';
  id: string;
  allowed: boolean;
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
  readonly id: string;
  readonly displayName: string;
  readonly available: boolean;
  sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent>;
  loadHistory(messages: ChatMessage[]): void;
  abort(): void;
}
