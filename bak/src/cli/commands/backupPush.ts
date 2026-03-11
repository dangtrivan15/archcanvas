/**
 * CLI `backup-push` Command
 *
 * Pushes the current state of the repository to remote as a version-controlled
 * backup before any cleanup begins. Creates a tagged snapshot for easy rollback
 * and optionally locks the branch to prevent concurrent merges.
 *
 * Usage:
 *   archcanvas backup-push
 *   archcanvas backup-push --stash          # auto-stash uncommitted changes
 *   archcanvas backup-push --remote upstream # push to a different remote
 *   archcanvas backup-push --lock           # enable branch protection after push
 *   archcanvas backup-push --dry-run        # show what would be done without executing
 */

import { Command } from 'commander';
import { type GlobalOptions, withErrorHandler } from '@/cli/index';

export interface BackupPushOptions {
  remote: string;
  stash: boolean;
  lock: boolean;
  dryRun: boolean;
  tagPrefix: string;
}

export interface BackupPushResult {
  tag: string;
  branch: string;
  remote: string;
  commitSha: string;
  pushed: boolean;
  locked: boolean;
  stashed: boolean;
  dryRun: boolean;
  warnings: string[];
}

/**
 * Interface for executing git commands — injectable for testing.
 */
export interface GitRunner {
  exec(args: string[]): Promise<string>;
}

/**
 * Default GitRunner that shells out to the real git binary.
 */
export class RealGitRunner implements GitRunner {
  async exec(args: string[]): Promise<string> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync('git', args, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  }
}

/** Default git runner instance (overridden in tests). */
let _gitRunner: GitRunner = new RealGitRunner();

/** Set the git runner (for testing). */
export function setGitRunner(runner: GitRunner): void {
  _gitRunner = runner;
}

/** Reset to real git runner. */
export function resetGitRunner(): void {
  _gitRunner = new RealGitRunner();
}

/** Execute a git command via the current runner. */
function execGit(args: string[]): Promise<string> {
  return _gitRunner.exec(args);
}

/**
 * Check if the git working tree is clean (no uncommitted changes).
 */
export async function isWorkingTreeClean(): Promise<boolean> {
  const status = await execGit(['status', '--porcelain']);
  return status.length === 0;
}

/**
 * Get the current branch name.
 */
export async function getCurrentBranch(): Promise<string> {
  return execGit(['branch', '--show-current']);
}

/**
 * Get the current HEAD commit SHA (short).
 */
export async function getHeadSha(): Promise<string> {
  return execGit(['rev-parse', '--short', 'HEAD']);
}

/**
 * Get the full HEAD commit SHA.
 */
export async function getHeadShaFull(): Promise<string> {
  return execGit(['rev-parse', 'HEAD']);
}

/**
 * Generate a backup tag name with today's date.
 * Format: pre-cleanup-backup-v<YYYY-MM-DD>
 * If the tag already exists, appends a numeric suffix: -2, -3, etc.
 */
export async function generateTagName(prefix: string): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const baseTag = `${prefix}${yyyy}-${mm}-${dd}`;

  // Check if tag exists
  try {
    await execGit(['rev-parse', '--verify', `refs/tags/${baseTag}`]);
    // Tag exists — find next suffix
    let suffix = 2;
    while (suffix < 100) {
      const candidateTag = `${baseTag}-${suffix}`;
      try {
        await execGit(['rev-parse', '--verify', `refs/tags/${candidateTag}`]);
        suffix++;
      } catch {
        return candidateTag;
      }
    }
    throw new Error(`Too many backup tags for today (${baseTag})`);
  } catch {
    // Tag doesn't exist — use base name
    return baseTag;
  }
}

/**
 * Create a git tag on the current HEAD.
 */
export async function createTag(tagName: string, message: string): Promise<void> {
  await execGit(['tag', '-a', tagName, '-m', message]);
}

/**
 * Push branch and tags to remote.
 */
export async function pushToRemote(remote: string, branch: string): Promise<void> {
  await execGit(['push', remote, branch, '--tags']);
}

/**
 * Stash uncommitted changes.
 * Returns true if changes were stashed, false if working tree was already clean.
 */
export async function stashChanges(): Promise<boolean> {
  const before = await execGit(['stash', 'list']);
  await execGit(['stash', 'push', '-m', 'archcanvas-backup-push-auto-stash']);
  const after = await execGit(['stash', 'list']);
  return before !== after;
}

/**
 * Verify a tag exists on the remote.
 */
export async function verifyRemoteTag(remote: string, tagName: string): Promise<boolean> {
  try {
    const output = await execGit(['ls-remote', '--tags', remote, `refs/tags/${tagName}`]);
    return output.includes(tagName);
  } catch {
    return false;
  }
}

/**
 * Attempt to enable branch protection via GitHub API.
 * Requires GITHUB_TOKEN or GH_TOKEN environment variable.
 * Returns true if protection was enabled, false if skipped.
 */
export async function enableBranchProtection(
  remote: string,
  branch: string,
): Promise<{ locked: boolean; warning?: string }> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    return {
      locked: false,
      warning:
        'Branch protection skipped: no GITHUB_TOKEN or GH_TOKEN environment variable set. ' +
        'Set one of these tokens to enable automatic branch locking.',
    };
  }

  // Parse GitHub owner/repo from remote URL
  const remoteUrl = await execGit(['remote', 'get-url', remote]);
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (!match) {
    return {
      locked: false,
      warning: `Branch protection skipped: could not parse GitHub owner/repo from remote URL: ${remoteUrl}`,
    };
  }

  const [, owner, repo] = match;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`;

  try {
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        required_status_checks: null,
        enforce_admins: true,
        required_pull_request_reviews: {
          required_approving_review_count: 1,
          dismiss_stale_reviews: false,
          require_code_owner_reviews: false,
        },
        restrictions: null,
        lock_branch: true,
        allow_force_pushes: false,
        allow_deletions: false,
      }),
    });

    if (response.ok) {
      return { locked: true };
    } else {
      const body = await response.text();
      return {
        locked: false,
        warning: `Branch protection API returned ${response.status}: ${body}`,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      locked: false,
      warning: `Branch protection request failed: ${msg}`,
    };
  }
}

/**
 * Execute the full backup-push pipeline.
 */
export async function executeBackupPush(options: BackupPushOptions): Promise<BackupPushResult> {
  const warnings: string[] = [];
  let stashed = false;

  // 1. Ensure working tree is clean
  const clean = await isWorkingTreeClean();
  if (!clean) {
    if (options.stash) {
      if (!options.dryRun) {
        stashed = await stashChanges();
        if (stashed) {
          warnings.push('Uncommitted changes were auto-stashed. Run `git stash pop` to restore.');
        }
      } else {
        stashed = true;
        warnings.push('[dry-run] Would auto-stash uncommitted changes.');
      }
    } else {
      throw new Error(
        'Working tree is not clean. Commit or stash your changes first, or use --stash to auto-stash.',
      );
    }
  }

  // 2. Get current branch and SHA
  const branch = await getCurrentBranch();
  if (!branch) {
    throw new Error('Not on a branch (detached HEAD). Please checkout a branch first.');
  }
  const commitSha = await getHeadSha();

  // 3. Create tag
  const tag = await generateTagName(options.tagPrefix);
  if (!options.dryRun) {
    await createTag(tag, `Pre-cleanup backup snapshot on ${branch} at ${commitSha}`);
  } else {
    warnings.push(`[dry-run] Would create tag: ${tag}`);
  }

  // 4. Push branch and tag to remote
  let pushed = false;
  if (!options.dryRun) {
    try {
      await pushToRemote(options.remote, branch);
      pushed = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Push failed: ${msg}`);
    }
  } else {
    warnings.push(`[dry-run] Would push ${branch} and tags to ${options.remote}`);
  }

  // 5. Enable branch protection (if --lock)
  let locked = false;
  if (options.lock) {
    if (!options.dryRun) {
      const protResult = await enableBranchProtection(options.remote, branch);
      locked = protResult.locked;
      if (protResult.warning) {
        warnings.push(protResult.warning);
      }
    } else {
      warnings.push(`[dry-run] Would enable branch protection on ${options.remote}/${branch}`);
    }
  }

  // 6. Verify remote tag (if push was attempted)
  if (pushed && !options.dryRun) {
    const tagVisible = await verifyRemoteTag(options.remote, tag);
    if (!tagVisible) {
      warnings.push(`Warning: Tag ${tag} may not be visible on remote yet. Verify manually.`);
    }
  }

  return {
    tag,
    branch,
    remote: options.remote,
    commitSha,
    pushed,
    locked,
    stashed,
    dryRun: options.dryRun,
    warnings,
  };
}

/**
 * Register the `backup-push` subcommand on the given Commander program.
 */
export function registerBackupPushCommand(program: Command): void {
  program
    .command('backup-push')
    .description('Push a tagged backup of the current state to remote before cleanup')
    .option('--remote <name>', 'Git remote to push to', 'origin')
    .option('--stash', 'Auto-stash uncommitted changes before pushing', false)
    .option('--lock', 'Enable branch protection on remote after push', false)
    .option('--dry-run', 'Show what would be done without making changes', false)
    .option('--tag-prefix <prefix>', 'Tag name prefix', 'pre-cleanup-backup-v')
    .action(
      withErrorHandler(async (cmdOpts: BackupPushOptions) => {
        const opts = program.opts<GlobalOptions>();

        if (!opts.quiet) {
          console.log('Starting backup push...');
        }

        const result = await executeBackupPush(cmdOpts);

        // Output result
        if (opts.format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (result.dryRun) {
            console.log('\n[DRY RUN] No changes were made.\n');
          }

          console.log(`  Branch:  ${result.branch}`);
          console.log(`  Commit:  ${result.commitSha}`);
          console.log(`  Tag:     ${result.tag}`);
          console.log(`  Remote:  ${result.remote}`);
          console.log(`  Pushed:  ${result.pushed ? 'yes' : 'no'}`);
          console.log(`  Locked:  ${result.locked ? 'yes' : 'no'}`);

          if (result.stashed) {
            console.log(`  Stashed: yes (run \`git stash pop\` to restore)`);
          }

          if (result.warnings.length > 0) {
            console.log('\nWarnings:');
            for (const w of result.warnings) {
              console.log(`  - ${w}`);
            }
          }

          if (result.pushed) {
            console.log(`\nBackup complete. To rollback: git checkout ${result.tag}`);
          }
        }
      }),
    );
}
