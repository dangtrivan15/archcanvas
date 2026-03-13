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
  /** File path that triggered the permission request (from SDK canUseTool options). */
  blockedPath?: string;
  /** Explains why this permission request was triggered. */
  decisionReason?: string;
}

// ---------------------------------------------------------------------------
// AskUserQuestion — Claude's clarifying-question tool.
//
// When Claude calls AskUserQuestion, the SDK invokes canUseTool with the
// question payload.  Instead of a simple allow/deny, we need the user's
// actual answer.  The bridge emits this event so the browser can show an
// interactive question card; the user's selections are sent back as a
// QuestionResponseClientMessage, and the bridge returns them to the SDK
// via `{ behavior: 'allow', updatedInput: { questions, answers } }`.
//
// See: https://platform.claude.com/docs/en/agent-sdk/user-input
// ---------------------------------------------------------------------------

/** A single option within an AskUserQuestion question. */
export interface AskUserQuestionOption {
  label: string;
  description: string;
  /** Optional HTML/markdown preview (only present when toolConfig.askUserQuestion.previewFormat is set). */
  preview?: string;
}

/** A single question from the AskUserQuestion tool. */
export interface AskUserQuestion {
  question: string;
  header: string;
  options: AskUserQuestionOption[];
  multiSelect: boolean;
}

/**
 * Emitted when Claude calls AskUserQuestion and needs the user to pick
 * from options (or type a free-text "Other" answer).
 */
export interface AskUserQuestionEvent extends ChatEventBase {
  type: 'ask_user_question';
  /** The tool_use ID — used to correlate the response. */
  id: string;
  /** The full array of questions Claude wants answered. */
  questions: AskUserQuestion[];
}

export interface StatusEvent extends ChatEventBase {
  type: 'status';
  message: string;
}

export interface RateLimitEvent extends ChatEventBase {
  type: 'rate_limit';
  message: string;
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
  | AskUserQuestionEvent
  | StatusEvent
  | RateLimitEvent
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

/**
 * Sent by the browser when the user answers an AskUserQuestion card.
 * `answers` is a record of question text → selected label(s) (or free text).
 * Matches the SDK's expected response format for canUseTool + AskUserQuestion.
 */
export interface QuestionResponseClientMessage {
  type: 'question_response';
  id: string;
  answers: Record<string, string>;
}

export type ClientMessage =
  | ChatClientMessage
  | AbortClientMessage
  | LoadHistoryClientMessage
  | PermissionResponseClientMessage
  | QuestionResponseClientMessage;

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
