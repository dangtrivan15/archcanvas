import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, type TestContext } from '../helpers/testApp';
import { createTestUser, createTestJWT } from '../helpers/testAuth';
import { seedBulkFixtures } from '../helpers/testFixtures';

describe('GET /api/v1/nodedefs (search)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = createTestApp();
    const user = createTestUser(ctx.db, {
      username: 'searcher',
      githubId: 1001,
    });
    token = createTestJWT(ctx.authService, user.id, user.username);
    await seedBulkFixtures(ctx.app, token);
  });

  it('returns all NodeDefs with no query', async () => {
    const res = await ctx.app.request('/api/v1/nodedefs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });

  it('searches by full-text query', async () => {
    const res = await ctx.app.request('/api/v1/nodedefs?q=kubernetes');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(3);
    for (const item of body.items) {
      const text = `${item.namespace} ${item.name} ${item.displayName} ${item.description} ${item.tags.join(' ')}`;
      expect(text.toLowerCase()).toContain('kubernetes');
    }
  });

  it('filters by namespace', async () => {
    const res = await ctx.app.request('/api/v1/nodedefs?namespace=aws');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(2);
    for (const item of body.items) {
      expect(item.namespace).toBe('aws');
    }
  });

  it('filters by tag', async () => {
    const res = await ctx.app.request('/api/v1/nodedefs?tag=serverless');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    for (const item of body.items) {
      expect(item.tags).toContain('serverless');
    }
  });

  it('combines query and namespace filter', async () => {
    const res = await ctx.app.request(
      '/api/v1/nodedefs?q=container&namespace=docker',
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(item.namespace).toBe('docker');
    }
  });

  it('paginates results', async () => {
    const res = await ctx.app.request(
      '/api/v1/nodedefs?pageSize=3&page=1',
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeLessThanOrEqual(3);
    expect(body.pageSize).toBe(3);
    expect(body.page).toBe(1);

    // Get page 2
    const res2 = await ctx.app.request(
      '/api/v1/nodedefs?pageSize=3&page=2',
    );
    const body2 = await res2.json();
    expect(body2.page).toBe(2);
    // Ensure different items
    if (body2.items.length > 0) {
      expect(body2.items[0].name).not.toBe(body.items[0].name);
    }
  });

  it('sorts by name', async () => {
    const res = await ctx.app.request('/api/v1/nodedefs?sort=name');
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.items.map((i: { name: string }) => i.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('returns empty results for non-matching query', async () => {
    const res = await ctx.app.request(
      '/api/v1/nodedefs?q=zzzznonexistent',
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('returns correct item shape', async () => {
    const res = await ctx.app.request('/api/v1/nodedefs?pageSize=1');
    expect(res.status).toBe(200);
    const body = await res.json();
    const item = body.items[0];
    expect(item).toHaveProperty('namespace');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('version');
    expect(item).toHaveProperty('displayName');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('icon');
    expect(item).toHaveProperty('tags');
    expect(item).toHaveProperty('shape');
    expect(item).toHaveProperty('publisher');
    expect(item.publisher).toHaveProperty('username');
    expect(item).toHaveProperty('downloads');
    expect(item).toHaveProperty('createdAt');
    expect(item).toHaveProperty('updatedAt');
  });
});
