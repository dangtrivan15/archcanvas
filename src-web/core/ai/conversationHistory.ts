import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
// NOTE: Do NOT add unlinkSync here — conversationHistory.ts has no delete semantics.
// Importing it unused causes TS6133 under "noUnusedLocals": true.
import { join } from 'path';

export const ARCHCANVAS_DIR = '.archcanvas';

export function archcanvasPath(cwd: string, file: string): string {
  return join(cwd, ARCHCANVAS_DIR, file);
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface HistoryFile {
  sessionId?: string;
  messages: StoredMessage[];
  summary?: string;
}

export const MAX_MESSAGES = 40;      // 20 user+assistant pairs
export const MAX_CHAR_LENGTH = 80_000;

export function loadHistory(cwd: string): HistoryFile {
  const histPath = archcanvasPath(cwd, 'history.json');
  if (!existsSync(histPath)) {
    return { messages: [] };
  }
  try {
    return JSON.parse(readFileSync(histPath, 'utf-8')) as HistoryFile;
  } catch {
    return { messages: [] };
  }
}

export function saveHistory(cwd: string, file: HistoryFile): void {
  const dir = join(cwd, ARCHCANVAS_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(archcanvasPath(cwd, 'history.json'), JSON.stringify(file, null, 2), 'utf-8');
}

export function trimHistory(messages: StoredMessage[]): StoredMessage[] {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (messages.length <= MAX_MESSAGES && totalChars <= MAX_CHAR_LENGTH) {
    return messages;
  }
  const kept = messages.slice(-MAX_MESSAGES);
  const trimmedCount = messages.length - kept.length;
  const notice: StoredMessage = {
    role: 'assistant',
    content: `[${trimmedCount} earlier message${trimmedCount !== 1 ? 's' : ''} trimmed for context window management]`,
    timestamp: kept[0]?.timestamp ?? Date.now(),
  };
  return [notice, ...kept];
}

export function buildSummary(messages: StoredMessage[]): string {
  const pairs = Math.floor(messages.length / 2);
  const recentUserMsgs = messages
    .filter(m => m.role === 'user')
    .slice(-2)
    .map(m => m.content.slice(0, 120).replace(/\n/g, ' '))
    .join('; ');
  return `This project has ${pairs} prior conversation exchange${pairs !== 1 ? 's' : ''}. ` +
    `Recent topics: ${recentUserMsgs || 'architecture discussion'}.`;
}
