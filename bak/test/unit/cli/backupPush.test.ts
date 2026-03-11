/**
 * Tests for CLI `backup-push` command (Feature #432).
 *
 * Verifies:
 * - Command registration with correct name, description, and options
 * - Working tree clean check
 * - Tag name generation with date and suffix
 * - Stash option behavior
 * - Dry-run mode
 * - Push and lock flow
 * - Error handling for dirty working tree and detached HEAD
 * - Branch protection token check
 * - Custom remote and tag prefix
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProgram } from '@/cli/index';
import {
  type GitRunner,
  setGitRunner,
  resetGitRunner,
  isWorkingTreeClean,
  getCurrentBranch,
  getHeadSha,
  generateTagName,
  createTag,
  pushToRemote,
  stashChanges,
  verifyRemoteTag,
  enableBranchProtection,
  executeBackupPush,
} from '@/cli/commands/backupPush';

// ─── Mock GitRunner ─────────────────────────────────────────────

class MockGitRunner implements GitRunner {
  private responses: Array<{ match: string | RegExp; value: string | Error }> = [];
  public calls: string[][] = [];

  /** Register a response for args matching a string or regex. */
  on(match: string | RegExp, value: string | Error): MockGitRunner {
    this.responses.push({ match, value });
    return this;
  }

  async exec(args: string[]): Promise<string> {
    this.calls.push(args);
    const key = args.join(' ');
    for (const { match, value } of this.responses) {
      const matched = typeof match === 'string' ? key.includes(match) : match.test(key);
      if (matched) {
        if (value instanceof Error) throw value;
        return value;
      }
    }
    // Default: return empty string
    return '';
  }
}

// ─── Command Registration ────────────────────────────────────────

describe('CLI backup-push command', () => {
  describe('Command Registration', () => {
    it('registers the backup-push subcommand', () => {
      const program = createProgram();
      const commandNames = program.commands.map((c) => c.name());
      expect(commandNames).toContain('backup-push');
    });

    it('has a description mentioning backup', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'backup-push');
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toMatch(/backup/i);
    });

    it('has --remote option with default "origin"', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'backup-push');
      const opt = cmd!.options.find((o) => o.long === '--remote');
      expect(opt).toBeDefined();
      expect(opt!.defaultValue).toBe('origin');
    });

    it('has --stash option', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'backup-push');
      const opt = cmd!.options.find((o) => o.long === '--stash');
      expect(opt).toBeDefined();
    });

    it('has --lock option', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'backup-push');
      const opt = cmd!.options.find((o) => o.long === '--lock');
      expect(opt).toBeDefined();
    });

    it('has --dry-run option', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'backup-push');
      const opt = cmd!.options.find((o) => o.long === '--dry-run');
      expect(opt).toBeDefined();
    });

    it('has --tag-prefix option with default "pre-cleanup-backup-v"', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'backup-push');
      const opt = cmd!.options.find((o) => o.long === '--tag-prefix');
      expect(opt).toBeDefined();
      expect(opt!.defaultValue).toBe('pre-cleanup-backup-v');
    });
  });

  // ─── Utility Functions ────────────────────────────────────────

  describe('Utility Functions', () => {
    afterEach(() => {
      resetGitRunner();
    });

    it('isWorkingTreeClean returns true when porcelain output is empty', async () => {
      const mock = new MockGitRunner().on('--porcelain', '');
      setGitRunner(mock);
      expect(await isWorkingTreeClean()).toBe(true);
    });

    it('isWorkingTreeClean returns false when porcelain has output', async () => {
      const mock = new MockGitRunner().on('--porcelain', ' M src/file.ts');
      setGitRunner(mock);
      expect(await isWorkingTreeClean()).toBe(false);
    });

    it('getCurrentBranch returns branch name', async () => {
      const mock = new MockGitRunner().on('--show-current', 'main');
      setGitRunner(mock);
      expect(await getCurrentBranch()).toBe('main');
    });

    it('getHeadSha returns short SHA', async () => {
      const mock = new MockGitRunner().on('--short', 'abc1234');
      setGitRunner(mock);
      expect(await getHeadSha()).toBe('abc1234');
    });

    it('generateTagName creates date-based tag when tag does not exist', async () => {
      const mock = new MockGitRunner().on('rev-parse --verify', new Error('not found'));
      setGitRunner(mock);
      const tag = await generateTagName('pre-cleanup-backup-v');
      expect(tag).toMatch(/^pre-cleanup-backup-v\d{4}-\d{2}-\d{2}$/);
    });

    it('generateTagName appends -2 suffix when base tag exists', async () => {
      let callCount = 0;
      const mock: GitRunner = {
        async exec(args: string[]) {
          const key = args.join(' ');
          if (key.includes('rev-parse --verify')) {
            callCount++;
            if (callCount === 1) return 'abc123'; // base tag exists
            throw new Error('not found'); // suffix tag doesn't
          }
          return '';
        },
      };
      setGitRunner(mock);
      const tag = await generateTagName('pre-cleanup-backup-v');
      expect(tag).toMatch(/^pre-cleanup-backup-v\d{4}-\d{2}-\d{2}-2$/);
    });

    it('createTag calls git tag -a', async () => {
      const mock = new MockGitRunner().on('tag -a', '');
      setGitRunner(mock);
      await createTag('my-tag', 'A message');
      expect(mock.calls.some((c) => c.includes('-a') && c.includes('my-tag'))).toBe(true);
    });

    it('pushToRemote calls git push with remote, branch, --tags', async () => {
      const mock = new MockGitRunner().on('push', '');
      setGitRunner(mock);
      await pushToRemote('origin', 'main');
      const pushCall = mock.calls.find((c) => c[0] === 'push');
      expect(pushCall).toBeDefined();
      expect(pushCall).toContain('origin');
      expect(pushCall).toContain('main');
      expect(pushCall).toContain('--tags');
    });

    it('stashChanges returns true when stash list changes', async () => {
      let listCalls = 0;
      const mock: GitRunner = {
        async exec(args: string[]) {
          const key = args.join(' ');
          if (key.includes('stash list')) {
            listCalls++;
            return listCalls === 1 ? '' : 'stash@{0}: archcanvas';
          }
          return '';
        },
      };
      setGitRunner(mock);
      expect(await stashChanges()).toBe(true);
    });

    it('verifyRemoteTag returns true when ls-remote contains tag', async () => {
      const mock = new MockGitRunner().on('ls-remote', 'abc123\trefs/tags/my-tag');
      setGitRunner(mock);
      expect(await verifyRemoteTag('origin', 'my-tag')).toBe(true);
    });

    it('verifyRemoteTag returns false when ls-remote fails', async () => {
      const mock = new MockGitRunner().on('ls-remote', new Error('network'));
      setGitRunner(mock);
      expect(await verifyRemoteTag('origin', 'my-tag')).toBe(false);
    });
  });

  // ─── executeBackupPush ────────────────────────────────────────

  describe('executeBackupPush', () => {
    afterEach(() => {
      resetGitRunner();
    });

    function createCleanMock(): MockGitRunner {
      return new MockGitRunner()
        .on('--porcelain', '')
        .on('--show-current', 'main')
        .on('--short', 'abc1234')
        .on('rev-parse HEAD', 'abc1234567890')
        .on('rev-parse --verify', new Error('not found'))
        .on('tag -a', '')
        .on('push', '')
        .on('ls-remote', 'abc123\trefs/tags/pre-cleanup-backup-v');
    }

    it('throws when working tree is dirty and --stash is false', async () => {
      const mock = new MockGitRunner().on('--porcelain', ' M dirty.ts');
      setGitRunner(mock);

      await expect(
        executeBackupPush({
          remote: 'origin',
          stash: false,
          lock: false,
          dryRun: false,
          tagPrefix: 'pre-cleanup-backup-v',
        }),
      ).rejects.toThrow(/not clean/i);
    });

    it('dry-run mode does not create tags or push', async () => {
      const mock = createCleanMock();
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'origin',
        stash: false,
        lock: false,
        dryRun: true,
        tagPrefix: 'pre-cleanup-backup-v',
      });

      expect(result.dryRun).toBe(true);
      expect(result.pushed).toBe(false);
      expect(result.branch).toBe('main');
      expect(result.tag).toMatch(/^pre-cleanup-backup-v\d{4}-\d{2}-\d{2}/);
      expect(result.warnings.some((w) => w.includes('[dry-run]'))).toBe(true);
      // Should not have called tag or push
      expect(mock.calls.some((c) => c[0] === 'tag')).toBe(false);
      expect(mock.calls.some((c) => c[0] === 'push')).toBe(false);
    });

    it('returns correct result on successful push', async () => {
      const mock = createCleanMock();
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'origin',
        stash: false,
        lock: false,
        dryRun: false,
        tagPrefix: 'pre-cleanup-backup-v',
      });

      expect(result.pushed).toBe(true);
      expect(result.branch).toBe('main');
      expect(result.commitSha).toBe('abc1234');
      expect(result.tag).toMatch(/^pre-cleanup-backup-v/);
      expect(result.locked).toBe(false);
      expect(result.stashed).toBe(false);
    });

    it('stash option auto-stashes dirty working tree', async () => {
      let stashListCount = 0;
      const mock: GitRunner = {
        async exec(args: string[]) {
          const key = args.join(' ');
          if (key.includes('--porcelain')) return ' M dirty.ts';
          if (key.includes('stash list')) {
            stashListCount++;
            return stashListCount === 1 ? '' : 'stash@{0}: auto';
          }
          if (key.includes('stash push')) return '';
          if (key.includes('--show-current')) return 'main';
          if (key.includes('--short')) return 'abc1234';
          if (key.includes('rev-parse --verify')) throw new Error('not found');
          if (key.includes('tag -a')) return '';
          if (key.includes('push')) return '';
          if (key.includes('ls-remote')) return 'pre-cleanup';
          return '';
        },
      };
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'origin',
        stash: true,
        lock: false,
        dryRun: false,
        tagPrefix: 'pre-cleanup-backup-v',
      });

      expect(result.stashed).toBe(true);
      expect(result.warnings.some((w) => w.includes('auto-stash'))).toBe(true);
    });

    it('lock option warns when no GitHub token is set', async () => {
      const origGH = process.env.GITHUB_TOKEN;
      const origGHT = process.env.GH_TOKEN;
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;

      const mock = createCleanMock();
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'origin',
        stash: false,
        lock: true,
        dryRun: false,
        tagPrefix: 'pre-cleanup-backup-v',
      });

      expect(result.locked).toBe(false);
      expect(result.warnings.some((w) => w.includes('GITHUB_TOKEN'))).toBe(true);

      if (origGH) process.env.GITHUB_TOKEN = origGH;
      if (origGHT) process.env.GH_TOKEN = origGHT;
    });

    it('throws on detached HEAD (empty branch name)', async () => {
      const mock = new MockGitRunner().on('--porcelain', '').on('--show-current', '');
      setGitRunner(mock);

      await expect(
        executeBackupPush({
          remote: 'origin',
          stash: false,
          lock: false,
          dryRun: false,
          tagPrefix: 'pre-cleanup-backup-v',
        }),
      ).rejects.toThrow(/not on a branch/i);
    });

    it('captures push failure as warning instead of throwing', async () => {
      const mock = new MockGitRunner()
        .on('--porcelain', '')
        .on('--show-current', 'main')
        .on('--short', 'abc1234')
        .on('rev-parse --verify', new Error('not found'))
        .on('tag -a', '')
        .on('push', new Error('remote: Permission denied'));
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'origin',
        stash: false,
        lock: false,
        dryRun: false,
        tagPrefix: 'pre-cleanup-backup-v',
      });

      expect(result.pushed).toBe(false);
      expect(result.warnings.some((w) => w.includes('Push failed'))).toBe(true);
    });

    it('custom tag prefix is used in generated tag', async () => {
      const mock = createCleanMock();
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'origin',
        stash: false,
        lock: false,
        dryRun: false,
        tagPrefix: 'custom-backup-v',
      });

      expect(result.tag).toMatch(/^custom-backup-v\d{4}-\d{2}-\d{2}/);
    });

    it('custom remote is passed to push command', async () => {
      const mock = createCleanMock();
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'upstream',
        stash: false,
        lock: false,
        dryRun: false,
        tagPrefix: 'pre-cleanup-backup-v',
      });

      expect(result.remote).toBe('upstream');
      expect(mock.calls.some((c) => c[0] === 'push' && c[1] === 'upstream')).toBe(true);
    });

    it('dry-run with lock includes lock warning', async () => {
      const mock = createCleanMock();
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'origin',
        stash: false,
        lock: true,
        dryRun: true,
        tagPrefix: 'pre-cleanup-backup-v',
      });

      expect(result.warnings.some((w) => w.includes('branch protection'))).toBe(true);
    });

    it('dry-run with stash includes stash warning', async () => {
      const mock = new MockGitRunner()
        .on('--porcelain', ' M dirty.ts')
        .on('--show-current', 'develop')
        .on('--short', 'def5678')
        .on('rev-parse --verify', new Error('not found'));
      setGitRunner(mock);

      const result = await executeBackupPush({
        remote: 'origin',
        stash: true,
        lock: false,
        dryRun: true,
        tagPrefix: 'pre-cleanup-backup-v',
      });

      expect(result.stashed).toBe(true);
      expect(result.warnings.some((w) => w.includes('auto-stash'))).toBe(true);
    });
  });

  // ─── enableBranchProtection ────────────────────────────────────

  describe('enableBranchProtection', () => {
    afterEach(() => {
      resetGitRunner();
    });

    it('returns warning when no token is set', async () => {
      const origGH = process.env.GITHUB_TOKEN;
      const origGHT = process.env.GH_TOKEN;
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;

      const result = await enableBranchProtection('origin', 'main');
      expect(result.locked).toBe(false);
      expect(result.warning).toContain('GITHUB_TOKEN');

      if (origGH) process.env.GITHUB_TOKEN = origGH;
      if (origGHT) process.env.GH_TOKEN = origGHT;
    });

    it('returns warning when remote URL is not GitHub', async () => {
      const origGH = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'test-token';

      const mock = new MockGitRunner().on('get-url', 'https://gitlab.com/user/repo.git');
      setGitRunner(mock);

      const result = await enableBranchProtection('origin', 'main');
      expect(result.locked).toBe(false);
      expect(result.warning).toContain('could not parse');

      if (origGH) process.env.GITHUB_TOKEN = origGH;
      else delete process.env.GITHUB_TOKEN;
    });
  });
});
