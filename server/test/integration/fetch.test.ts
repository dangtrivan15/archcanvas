import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, type TestContext } from '../helpers/testApp';
import { createTestUser, createTestJWT } from '../helpers/testAuth';
import { publishFixture } from '../helpers/testFixtures';

describe('GET /api/v1/nodedefs/:namespace/:name (fetch)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = createTestApp();
    const user = createTestUser(ctx.db, {
      username: 'fetcher',
      githubId: 2001,
    });
    token = createTestJWT(ctx.authService, user.id, user.username);

    // Publish a test fixture
    await publishFixture(ctx.app, token, 'valid-service.yaml');
  });

  it('returns full NodeDef in JSON format', async () => {
    const res = await ctx.app.request('/api/v1/nodedefs/testns/service');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.nodeDef).toBeDefined();
    expect(body.nodeDef.kind).toBe('NodeDef');
    expect(body.nodeDef.apiVersion).toBe('v1');

    // Verify spec and variants are top-level fields (not nested under spec)
    expect(body.nodeDef.spec).toBeDefined();
    expect(body.nodeDef.spec.args).toBeDefined();
    expect(body.nodeDef.spec.ports).toBeDefined();
    expect(body.nodeDef.spec).not.toHaveProperty('variants');
    expect(body.nodeDef.spec).not.toHaveProperty('spec');
    expect(body.nodeDef.variants).toBeDefined();
    expect(Array.isArray(body.nodeDef.variants)).toBe(true);
    expect(body.nodeDef.variants[0].name).toBe('REST API');

    expect(body.registry).toBeDefined();
    expect(body.registry.publisher.username).toBe('fetcher');
    expect(body.registry.versions).toContain('1.0.0');
    expect(body.registry.downloads).toHaveProperty('total');
    expect(body.registry.downloads).toHaveProperty('thisVersion');
  });

  it('returns 404 for non-existent NodeDef', async () => {
    const res = await ctx.app.request(
      '/api/v1/nodedefs/nonexistent/nothing',
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns specific version via query param', async () => {
    const res = await ctx.app.request(
      '/api/v1/nodedefs/testns/service?version=1.0.0',
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodeDef).toBeDefined();
  });

  it('returns 404 for non-existent version', async () => {
    const res = await ctx.app.request(
      '/api/v1/nodedefs/testns/service?version=99.99.99',
    );
    expect(res.status).toBe(404);
  });

  it('returns YAML format with correct headers', async () => {
    const res = await ctx.app.request(
      '/api/v1/nodedefs/testns/service?format=yaml',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/yaml');
    expect(res.headers.get('x-registry-publisher')).toBe('fetcher');
    expect(res.headers.get('x-registry-downloads')).toBeDefined();

    const text = await res.text();
    expect(text).toContain('kind: NodeDef');
    expect(text).toContain('name: service');
  });

  it('increments download count on fetch', async () => {
    // Fetch once to record a download
    await ctx.app.request('/api/v1/nodedefs/testns/service', {
      headers: { 'x-forwarded-for': '10.0.0.100' },
    });

    // Check count in DB
    const row = ctx.db
      .prepare(
        "SELECT total_downloads FROM nodedefs WHERE namespace = 'testns' AND name = 'service'",
      )
      .get() as { total_downloads: number };
    expect(row.total_downloads).toBeGreaterThanOrEqual(1);
  });
});
