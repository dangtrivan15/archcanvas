import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Hono } from 'hono';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

export function loadFixture(name: string): string {
  const filePath = path.join(FIXTURES_DIR, name);
  return fs.readFileSync(filePath, 'utf-8');
}

export async function publishFixture(
  app: Hono,
  token: string,
  fixtureName: string,
): Promise<Response> {
  const yaml = loadFixture(fixtureName);
  return app.request('/api/v1/nodedefs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/yaml',
    },
    body: yaml,
  });
}

export async function seedBulkFixtures(
  app: Hono,
  token: string,
): Promise<void> {
  const bulkDir = path.join(FIXTURES_DIR, 'bulk');
  const files = fs
    .readdirSync(bulkDir)
    .filter((f) => f.endsWith('.yaml'))
    .sort();

  for (const file of files) {
    await publishFixture(app, token, `bulk/${file}`);
  }
}
