import { describe, it, expect } from 'vitest';
import { CLIError } from '@/cli/errors';
import { formatSuccess, formatError } from '@/cli/output';

describe('formatSuccess', () => {
  describe('json mode', () => {
    it('produces valid JSON with ok: true', () => {
      const result = formatSuccess({ project: { name: 'test' } }, { json: true });
      const parsed = JSON.parse(result);
      expect(parsed.ok).toBe(true);
      expect(parsed.project.name).toBe('test');
    });

    it('includes all data fields', () => {
      const data = { nodes: 3, edges: 2, name: 'myProject' };
      const result = formatSuccess(data, { json: true });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ ok: true, nodes: 3, edges: 2, name: 'myProject' });
    });

    it('produces parseable JSON string', () => {
      const result = formatSuccess({ foo: 'bar' }, { json: true });
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('human mode', () => {
    it('returns a non-empty string', () => {
      const result = formatSuccess({ message: 'hello' }, { json: false });
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('includes data values in output', () => {
      const result = formatSuccess({ name: 'test-project', path: '/tmp/test' }, { json: false });
      expect(result).toContain('test-project');
      expect(result).toContain('/tmp/test');
    });

    it('handles nested objects', () => {
      const result = formatSuccess(
        { project: { name: 'test', version: '1.0' } },
        { json: false },
      );
      expect(result).toContain('project');
      expect(result).toContain('test');
    });

    it('handles arrays by showing item count', () => {
      const result = formatSuccess({ items: [1, 2, 3] }, { json: false });
      expect(result).toContain('3 items');
    });
  });
});

describe('formatError', () => {
  describe('json mode', () => {
    it('produces valid JSON with ok: false', () => {
      const error = new CLIError('PROJECT_NOT_FOUND', 'No project found');
      const result = formatError(error, { json: true });
      const parsed = JSON.parse(result);
      expect(parsed.ok).toBe(false);
    });

    it('has correct error shape: { code, message }', () => {
      const error = new CLIError('INVALID_ARGS', 'Missing --id flag');
      const result = formatError(error, { json: true });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe('INVALID_ARGS');
      expect(parsed.error.message).toBe('Missing --id flag');
    });

    it('produces parseable JSON string', () => {
      const error = new CLIError('PROJECT_LOAD_FAILED', 'Bad YAML');
      const result = formatError(error, { json: true });
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('human mode', () => {
    it('returns a non-empty string', () => {
      const error = new CLIError('PROJECT_NOT_FOUND', 'Not found');
      const result = formatError(error, { json: false });
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('includes error code and message', () => {
      const error = new CLIError('UNKNOWN_NODE_TYPE', 'Type foo/bar not found');
      const result = formatError(error, { json: false });
      expect(result).toContain('UNKNOWN_NODE_TYPE');
      expect(result).toContain('Type foo/bar not found');
    });

    it('follows Error: [CODE] message format', () => {
      const error = new CLIError('PROJECT_EXISTS', 'Already exists');
      const result = formatError(error, { json: false });
      expect(result).toBe('Error: [PROJECT_EXISTS] Already exists');
    });
  });
});
