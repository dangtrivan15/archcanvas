import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collect,
  testContext,
  getTestCwd,
  setupSession,
} from './bridge-test-helpers';
import type { ProjectContext } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Bridge CWD: context.projectPath overrides session cwd
// ---------------------------------------------------------------------------
describe('BridgeSession — CWD from context.projectPath', () => {
  it('passes context.projectPath as cwd to SDK query options', async () => {
    const overrideCwd = await mkdtemp(join(tmpdir(), 'bridge-cwd-test-'));
    const { session, capturedArgs } = setupSession();

    const context: ProjectContext = {
      ...testContext(),
      projectPath: overrideCwd,
    };

    await collect(session.sendMessage('hello', context));

    expect(capturedArgs).toHaveLength(1);
    const opts = capturedArgs[0].options as Record<string, unknown>;
    expect(opts.cwd).toBe(overrideCwd);

    session.destroy();
  });

  it('falls back to session cwd when context.projectPath is empty', async () => {
    const { session, capturedArgs } = setupSession();

    const context: ProjectContext = {
      ...testContext(),
      projectPath: '',
    };

    await collect(session.sendMessage('hello', context));

    expect(capturedArgs).toHaveLength(1);
    const opts = capturedArgs[0].options as Record<string, unknown>;
    // Falls back to session cwd (testCwd)
    expect(opts.cwd).toBe(getTestCwd());

    session.destroy();
  });

  it('expands tilde in projectPath before passing to SDK', async () => {
    const { session, capturedArgs } = setupSession();
    const home = require('os').homedir();

    const context: ProjectContext = {
      ...testContext(),
      projectPath: '~',
    };

    await collect(session.sendMessage('hello', context));

    expect(capturedArgs).toHaveLength(1);
    const opts = capturedArgs[0].options as Record<string, unknown>;
    expect(opts.cwd).toBe(home);

    session.destroy();
  });

  it('yields error when projectPath does not exist', async () => {
    const { session } = setupSession();

    const context: ProjectContext = {
      ...testContext(),
      projectPath: '/nonexistent/path/that/does/not/exist',
    };

    const events = await collect(session.sendMessage('hello', context));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'error',
      message: expect.stringContaining('does not exist'),
    });

    session.destroy();
  });
});
