/**
 * Git baseline reader — reads canvas YAML files at a git ref via a GitProvider.
 * Platform-agnostic: the provider hides all git/platform details.
 */

import type { Canvas } from '@/types';
import { parseCanvas } from '@/storage/yamlCodec';
import type { FileSystem } from '@/platform/fileSystem';
import type { GitProvider } from '@/platform/git';

export interface GitBaselineResult {
  yamls: Map<string, string>;
  canvases: Map<string, Canvas>;
  errors: Array<{ canvasId: string; error: string }>;
  ref: string;
}

async function listCanvasFiles(fs: FileSystem): Promise<string[]> {
  try {
    const files = await fs.listFiles('.archcanvas');
    return files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch {
    return [];
  }
}

export async function readGitBaseline(
  ref: string,
  git: GitProvider,
  fs: FileSystem,
): Promise<GitBaselineResult> {
  const canvasFiles = await listCanvasFiles(fs);

  const yamls = new Map<string, string>();
  const canvases = new Map<string, Canvas>();
  const errors: Array<{ canvasId: string; error: string }> = [];

  for (const file of canvasFiles) {
    const yaml = await git.readFileAtRef(ref, `.archcanvas/${file}`);
    if (yaml === null) continue; // Not present in this ref

    const canvasId = file === 'main.yaml' ? '__root__' : file.replace(/\.(yaml|yml)$/, '');
    yamls.set(canvasId, yaml);

    try {
      const parsed = parseCanvas(yaml);
      canvases.set(canvasId, parsed.data);
    } catch (err) {
      errors.push({ canvasId, error: err instanceof Error ? err.message : String(err) });
      canvases.set(canvasId, { nodes: [], edges: [], entities: [] });
    }
  }

  return { yamls, canvases, errors, ref };
}
