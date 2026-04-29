import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractDecisions,
  mergeIntoAdrFile,
  deleteDecisions,
} from '@/core/ai/decisionExtractor';
import { archcanvasPath, ARCHCANVAS_DIR } from '@/core/ai/conversationHistory';
import type { StoredMessage } from '@/core/ai/conversationHistory';

// ---------------------------------------------------------------------------
// Isolated temp directory per test
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'archcanvas-decisions-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// extractDecisions
// ---------------------------------------------------------------------------

describe('extractDecisions', () => {
  it('returns empty array for messages with no heuristic matches', () => {
    const messages: StoredMessage[] = [
      { role: 'user', content: 'What time is it?', timestamp: 1 },
      { role: 'assistant', content: 'I do not know.', timestamp: 2 },
    ];
    const result = extractDecisions(messages);
    expect(result).toEqual([]);
  });

  it('extracts a Decision from an assistant message with "I recommend..."', () => {
    const messages: StoredMessage[] = [
      { role: 'user', content: 'How should we handle auth?', timestamp: 1 },
      {
        role: 'assistant',
        content: 'I recommend using JWT tokens for stateless authentication in this service.',
        timestamp: 2,
      },
    ];
    const result = extractDecisions(messages);
    expect(result.length).toBeGreaterThan(0);
    const decision = result[0];
    expect(decision.title).toBeTruthy();
    expect(decision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(decision.decision).toBeTruthy();
  });

  it('ignores role: "user" messages (only processes assistant messages)', () => {
    const messages: StoredMessage[] = [
      {
        role: 'user',
        content: 'I recommend using PostgreSQL for the database.',
        timestamp: 1,
      },
    ];
    const result = extractDecisions(messages);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mergeIntoAdrFile
// ---------------------------------------------------------------------------

describe('mergeIntoAdrFile', () => {
  it('creates decisions.yaml when it does not exist', () => {
    const adrPath = archcanvasPath(testDir, 'decisions.yaml');
    expect(existsSync(adrPath)).toBe(false);

    mergeIntoAdrFile(testDir, [
      { title: 'Use PostgreSQL', date: '2026-04-29', decision: 'Use PostgreSQL for main database' },
    ]);

    expect(existsSync(adrPath)).toBe(true);
    const content = readFileSync(adrPath, 'utf-8');
    expect(content).toContain('Use PostgreSQL');
  });

  it('creates the .archcanvas directory if it does not exist', () => {
    const dir = join(testDir, ARCHCANVAS_DIR);
    expect(existsSync(dir)).toBe(false);

    mergeIntoAdrFile(testDir, [
      { title: 'Use Redis for caching', date: '2026-04-29', decision: 'Use Redis for caching sessions' },
    ]);

    expect(existsSync(dir)).toBe(true);
  });

  it('does not duplicate a decision with the same title (case-insensitive)', () => {
    mergeIntoAdrFile(testDir, [
      { title: 'Use PostgreSQL', date: '2026-04-29', decision: 'Use PostgreSQL as primary store' },
    ]);
    mergeIntoAdrFile(testDir, [
      { title: 'use postgresql', date: '2026-04-29', decision: 'Duplicate attempt' },
    ]);

    const content = readFileSync(archcanvasPath(testDir, 'decisions.yaml'), 'utf-8');
    // Count occurrences of the title line only
    const titleMatches = content.match(/- title:/g);
    expect(titleMatches).toHaveLength(1);
    // The duplicate entry's decision should not appear
    expect(content).not.toContain('Duplicate attempt');
  });

  it('appends new decisions when file already exists', () => {
    mergeIntoAdrFile(testDir, [
      { title: 'Use PostgreSQL', date: '2026-04-29', decision: 'Use PostgreSQL as primary store' },
    ]);
    mergeIntoAdrFile(testDir, [
      { title: 'Use Redis', date: '2026-04-29', decision: 'Use Redis for session caching' },
    ]);

    const content = readFileSync(archcanvasPath(testDir, 'decisions.yaml'), 'utf-8');
    expect(content).toContain('Use PostgreSQL');
    expect(content).toContain('Use Redis');
  });

  it('is a no-op when newDecisions array is empty', () => {
    mergeIntoAdrFile(testDir, []);
    expect(existsSync(archcanvasPath(testDir, 'decisions.yaml'))).toBe(false);
  });

  it('escapes double-quote characters in title to produce valid YAML', () => {
    mergeIntoAdrFile(testDir, [
      {
        title: 'use "Redis" as the cache layer',
        date: '2026-04-29',
        decision: 'We will use "Redis" for session caching',
      },
    ]);

    const content = readFileSync(archcanvasPath(testDir, 'decisions.yaml'), 'utf-8');
    // Title quotes must be escaped, not raw, to keep YAML valid
    expect(content).toContain('\\"Redis\\"');
    // The overall title line should not contain an unescaped bare double-quote mid-string
    // (i.e., no   title: "use "Redis"   pattern)
    expect(content).not.toMatch(/title: "use "Redis"/);
  });
});

// ---------------------------------------------------------------------------
// deleteDecisions
// ---------------------------------------------------------------------------

describe('deleteDecisions', () => {
  it('is a no-op when decisions.yaml does not exist', () => {
    // Should not throw
    expect(() => deleteDecisions(testDir)).not.toThrow();
  });

  it('removes decisions.yaml when it exists', () => {
    mergeIntoAdrFile(testDir, [
      { title: 'Use PostgreSQL', date: '2026-04-29', decision: 'Use PostgreSQL as primary store' },
    ]);

    const adrPath = archcanvasPath(testDir, 'decisions.yaml');
    expect(existsSync(adrPath)).toBe(true);

    deleteDecisions(testDir);

    expect(existsSync(adrPath)).toBe(false);
  });
});
