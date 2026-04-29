import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  archcanvasPath,
  loadHistory,
  saveHistory,
  trimHistory,
  buildSummary,
  MAX_MESSAGES,
  MAX_CHAR_LENGTH,
  ARCHCANVAS_DIR,
  type StoredMessage,
} from '@/core/ai/conversationHistory';

// ---------------------------------------------------------------------------
// Isolated temp directory per test
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'archcanvas-history-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// archcanvasPath
// ---------------------------------------------------------------------------

describe('archcanvasPath', () => {
  it('joins cwd + .archcanvas + filename correctly', () => {
    const result = archcanvasPath('/my/project', 'history.json');
    expect(result).toBe(join('/my/project', ARCHCANVAS_DIR, 'history.json'));
  });
});

// ---------------------------------------------------------------------------
// loadHistory
// ---------------------------------------------------------------------------

describe('loadHistory', () => {
  it('returns { messages: [] } when .archcanvas/ directory does not exist', () => {
    const result = loadHistory(testDir);
    expect(result).toEqual({ messages: [] });
  });

  it('returns { messages: [] } when history.json does not exist', async () => {
    await mkdir(join(testDir, ARCHCANVAS_DIR));
    const result = loadHistory(testDir);
    expect(result).toEqual({ messages: [] });
  });

  it('returns { messages: [] } on a corrupt JSON file (no throw)', async () => {
    await mkdir(join(testDir, ARCHCANVAS_DIR));
    await writeFile(archcanvasPath(testDir, 'history.json'), 'not valid json!!!');
    const result = loadHistory(testDir);
    expect(result).toEqual({ messages: [] });
  });

  it('round-trips with saveHistory preserving sessionId and all messages', () => {
    const messages: StoredMessage[] = [
      { role: 'user', content: 'Hello AI', timestamp: 1000 },
      { role: 'assistant', content: 'Hello user!', timestamp: 1001 },
    ];
    const histFile = { sessionId: 'test-session-abc', messages };

    saveHistory(testDir, histFile);
    const loaded = loadHistory(testDir);

    expect(loaded.sessionId).toBe('test-session-abc');
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[0]).toEqual({ role: 'user', content: 'Hello AI', timestamp: 1000 });
    expect(loaded.messages[1]).toEqual({ role: 'assistant', content: 'Hello user!', timestamp: 1001 });
  });
});

// ---------------------------------------------------------------------------
// saveHistory
// ---------------------------------------------------------------------------

describe('saveHistory', () => {
  it('creates .archcanvas/ directory when it does not exist', () => {
    const dir = join(testDir, ARCHCANVAS_DIR);
    expect(existsSync(dir)).toBe(false);

    saveHistory(testDir, { messages: [] });

    expect(existsSync(dir)).toBe(true);
    expect(existsSync(archcanvasPath(testDir, 'history.json'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// trimHistory
// ---------------------------------------------------------------------------

describe('trimHistory', () => {
  it('returns messages unchanged when below both MAX_MESSAGES and MAX_CHAR_LENGTH', () => {
    const messages: StoredMessage[] = [
      { role: 'user', content: 'Hello', timestamp: 1 },
      { role: 'assistant', content: 'Hi there', timestamp: 2 },
    ];
    const result = trimHistory(messages);
    expect(result).toBe(messages); // Same reference — no copy made
  });

  it('trims when messages.length > MAX_MESSAGES', () => {
    const messages: StoredMessage[] = Array.from({ length: MAX_MESSAGES + 2 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
      timestamp: i,
    }));

    const result = trimHistory(messages);
    // Result should have MAX_MESSAGES kept + 1 truncation notice
    expect(result.length).toBe(MAX_MESSAGES + 1);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toContain('trimmed');
  });

  it('trims when total chars exceed MAX_CHAR_LENGTH', () => {
    // Create messages whose total length exceeds MAX_CHAR_LENGTH
    // Use MAX_MESSAGES / 2 messages each with content > MAX_CHAR_LENGTH / (MAX_MESSAGES / 2)
    const bigContent = 'x'.repeat(Math.ceil(MAX_CHAR_LENGTH / 2) + 1);
    const messages: StoredMessage[] = [
      { role: 'user', content: bigContent, timestamp: 1 },
      { role: 'assistant', content: bigContent, timestamp: 2 },
    ];

    const result = trimHistory(messages);
    // Should have been trimmed (prepended notice)
    expect(result[0].content).toContain('trimmed');
  });

  it('prepends a truncation notice after trimming', () => {
    const messages: StoredMessage[] = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
      timestamp: i,
    }));

    const result = trimHistory(messages);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toMatch(/\d+ earlier messages? trimmed/);
  });
});

// ---------------------------------------------------------------------------
// buildSummary
// ---------------------------------------------------------------------------

describe('buildSummary', () => {
  it('returns a non-empty string for a non-empty message array', () => {
    const messages: StoredMessage[] = [
      { role: 'user', content: 'Design the auth layer', timestamp: 1 },
      { role: 'assistant', content: 'I recommend using JWT tokens...', timestamp: 2 },
    ];
    const result = buildSummary(messages);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes recent user message content in summary', () => {
    const messages: StoredMessage[] = [
      { role: 'user', content: 'Design the auth layer', timestamp: 1 },
      { role: 'assistant', content: 'Sure!', timestamp: 2 },
    ];
    const result = buildSummary(messages);
    expect(result).toContain('Design the auth layer');
  });
});
