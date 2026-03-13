import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { NodeFileSystem } from '../../../../src/platform/nodeFileSystem';
import { initCommand } from '../../../../src/cli/commands/init';

// Mock createFileSystem to bypass jsdom's window detection — tests
// run in jsdom where `typeof window !== 'undefined'`, but init needs
// NodeFileSystem. We return a real NodeFileSystem pointed at the temp dir.
vi.mock('../../../../src/platform/index', () => ({
  createFileSystem: vi.fn(async (root: string) => new NodeFileSystem(root)),
}));

describe('initCommand', () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'archcanvas-init-'));
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates .archcanvas/ directory and main.yaml (C5a.1, C5a.2)', async () => {
    await initCommand({ path: tempDir }, { json: false });

    const content = await readFile(join(tempDir, '.archcanvas', 'main.yaml'), 'utf-8');
    expect(content).toContain('project:');
    expect(content).toContain(`name: ${basename(tempDir)}`);
    expect(content).toContain('description: ""');
    expect(content).toContain('version: "1.0.0"');
    expect(content).toContain('nodes: []');
    expect(content).toContain('edges: []');
    expect(content).toContain('entities: []');
  });

  it('main.yaml matches exact template structure (C5a.2)', async () => {
    await initCommand({ path: tempDir, name: 'my-project' }, { json: false });

    const content = await readFile(join(tempDir, '.archcanvas', 'main.yaml'), 'utf-8');
    const expected = `project:
  name: my-project
  description: ""
  version: "1.0.0"

nodes: []
edges: []
entities: []
`;
    expect(content).toBe(expected);
  });

  it('exits with PROJECT_EXISTS if already initialized (C5a.3)', async () => {
    // Initialize once
    await initCommand({ path: tempDir }, { json: false });

    // Attempt to initialize again
    await expect(
      initCommand({ path: tempDir }, { json: false }),
    ).rejects.toThrow(
      expect.objectContaining({
        name: 'CLIError',
        code: 'PROJECT_EXISTS',
      }),
    );
  });

  it('uses directory name as default project name', async () => {
    await initCommand({ path: tempDir }, { json: false });

    const dirName = basename(tempDir);
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Initialized project '${dirName}'`),
    );
  });

  it('uses custom --name flag when provided (C5a.4)', async () => {
    await initCommand({ path: tempDir, name: 'custom-name' }, { json: false });

    const content = await readFile(join(tempDir, '.archcanvas', 'main.yaml'), 'utf-8');
    expect(content).toContain('name: custom-name');
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining("Initialized project 'custom-name'"),
    );
  });

  it('human output contains project name and path (C5a.4)', async () => {
    await initCommand({ path: tempDir, name: 'test-proj' }, { json: false });

    const output = stdoutSpy.mock.calls[0][0] as string;
    expect(output).toContain("Initialized project 'test-proj'");
    expect(output).toContain(tempDir);
  });

  it('JSON output has correct shape (C5a.5)', async () => {
    await initCommand({ path: tempDir, name: 'json-proj' }, { json: true });

    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      ok: true,
      project: {
        name: 'json-proj',
        path: tempDir,
      },
    });
  });

  it('uses cwd when no --path flag is provided', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    await initCommand({}, { json: false });

    const content = await readFile(join(tempDir, '.archcanvas', 'main.yaml'), 'utf-8');
    expect(content).toContain('project:');

    cwdSpy.mockRestore();
  });
});
