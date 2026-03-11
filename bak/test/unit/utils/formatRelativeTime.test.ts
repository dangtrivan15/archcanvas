import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "just now" for timestamps within 30 seconds', () => {
    const now = Date.now();
    expect(formatRelativeTime(now)).toBe('just now');
    expect(formatRelativeTime(now - 10_000)).toBe('just now');
    expect(formatRelativeTime(now - 29_000)).toBe('just now');
  });

  it('returns "just now" for future timestamps', () => {
    const now = Date.now();
    expect(formatRelativeTime(now + 5_000)).toBe('just now');
  });

  it('returns seconds for 30-59 seconds ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 45_000)).toBe('45 seconds ago');
    expect(formatRelativeTime(now - 30_000)).toBe('30 seconds ago');
  });

  it('returns "1 minute ago" for exactly 1 minute', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 60_000)).toBe('1 minute ago');
    expect(formatRelativeTime(now - 89_000)).toBe('1 minute ago');
  });

  it('returns "X minutes ago" for 2-59 minutes', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 2 * 60_000)).toBe('2 minutes ago');
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5 minutes ago');
    expect(formatRelativeTime(now - 30 * 60_000)).toBe('30 minutes ago');
    expect(formatRelativeTime(now - 59 * 60_000)).toBe('59 minutes ago');
  });

  it('returns "1 hour ago" for exactly 1 hour', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 60 * 60_000)).toBe('1 hour ago');
    expect(formatRelativeTime(now - 90 * 60_000)).toBe('1 hour ago');
  });

  it('returns "X hours ago" for 2-23 hours', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 2 * 3600_000)).toBe('2 hours ago');
    expect(formatRelativeTime(now - 12 * 3600_000)).toBe('12 hours ago');
    expect(formatRelativeTime(now - 23 * 3600_000)).toBe('23 hours ago');
  });

  it('returns "1 day ago" for exactly 1 day', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 24 * 3600_000)).toBe('1 day ago');
  });

  it('returns "X days ago" for 2-6 days', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 3 * 24 * 3600_000)).toBe('3 days ago');
    expect(formatRelativeTime(now - 6 * 24 * 3600_000)).toBe('6 days ago');
  });

  it('returns "1 week ago" for 7 days', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 7 * 24 * 3600_000)).toBe('1 week ago');
  });

  it('returns "X weeks ago" for 2-4 weeks', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 14 * 24 * 3600_000)).toBe('2 weeks ago');
    expect(formatRelativeTime(now - 28 * 24 * 3600_000)).toBe('4 weeks ago');
  });

  it('returns "1 month ago" for ~30 days', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 35 * 24 * 3600_000)).toBe('1 month ago');
  });

  it('returns "X months ago" for 2-11 months', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 90 * 24 * 3600_000)).toBe('3 months ago');
    expect(formatRelativeTime(now - 300 * 24 * 3600_000)).toBe('10 months ago');
  });

  it('returns "1 year ago" for ~365 days', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 400 * 24 * 3600_000)).toBe('1 year ago');
  });

  it('returns "X years ago" for 2+ years', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(formatRelativeTime(now - 800 * 24 * 3600_000)).toBe('2 years ago');
  });

  it('all timestamps use consistent relative format (no absolute dates)', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // All outputs should end with "ago" or be "just now"
    const testCases = [
      now,
      now - 45_000,
      now - 5 * 60_000,
      now - 2 * 3600_000,
      now - 3 * 24 * 3600_000,
      now - 14 * 24 * 3600_000,
      now - 90 * 24 * 3600_000,
      now - 400 * 24 * 3600_000,
    ];

    for (const ts of testCases) {
      const result = formatRelativeTime(ts);
      expect(
        result === 'just now' || result.endsWith(' ago'),
        `Expected relative format for ${ts}, got: "${result}"`,
      ).toBe(true);
    }
  });
});
