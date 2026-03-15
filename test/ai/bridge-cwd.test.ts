import { describe, it, expect } from 'vitest';
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
    const { session, capturedArgs } = setupSession();

    const context: ProjectContext = {
      ...testContext,
      projectPath: '/home/user/real-project',
    };

    await collect(session.sendMessage('hello', context));

    expect(capturedArgs).toHaveLength(1);
    const opts = capturedArgs[0].options as Record<string, unknown>;
    expect(opts.cwd).toBe('/home/user/real-project');

    session.destroy();
  });

  it('falls back to session cwd when context.projectPath is empty', async () => {
    const { session, capturedArgs } = setupSession();

    const context: ProjectContext = {
      ...testContext,
      projectPath: '',
    };

    await collect(session.sendMessage('hello', context));

    expect(capturedArgs).toHaveLength(1);
    const opts = capturedArgs[0].options as Record<string, unknown>;
    // Falls back to session cwd (testCwd)
    expect(opts.cwd).toBe(getTestCwd());

    session.destroy();
  });
});
