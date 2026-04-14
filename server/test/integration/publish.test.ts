import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestContext } from '../helpers/testApp';
import { createTestUser, createTestJWT, authHeader } from '../helpers/testAuth';
import { loadFixture } from '../helpers/testFixtures';

describe('POST /api/v1/nodedefs (publish)', () => {
  let ctx: TestContext;
  let user: ReturnType<typeof createTestUser>;
  let token: string;

  beforeEach(() => {
    ctx = createTestApp();
    user = createTestUser(ctx.db, {
      username: 'publisher',
      githubId: 3001,
    });
    token = createTestJWT(ctx.authService, user.id, user.username);
  });

  it('publishes a valid NodeDef (YAML content type)', async () => {
    const yaml = loadFixture('valid-service.yaml');
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.namespace).toBe('testns');
    expect(body.name).toBe('service');
    expect(body.version).toBe('1.0.0');
    expect(body.message).toBe('Published successfully');
  });

  it('publishes a valid NodeDef (JSON content type)', async () => {
    const yaml = loadFixture('valid-database.yaml');
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ yaml }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.namespace).toBe('testns');
    expect(body.name).toBe('database');
  });

  it('publishes a NodeDef with custom shape', async () => {
    const yaml = loadFixture('valid-custom-shape.yaml');
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(201);
  });

  it('returns 401 without auth header', async () => {
    const yaml = loadFixture('valid-service.yaml');
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: { 'Content-Type': 'text/yaml' },
      body: yaml,
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with invalid JWT', async () => {
    const yaml = loadFixture('valid-service.yaml');
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for malformed JSON body', async () => {
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'application/json',
      },
      body: 'not json',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 for invalid YAML', async () => {
    const yaml = loadFixture('invalid-yaml.yaml');
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 for invalid schema', async () => {
    const yaml = loadFixture('invalid-schema.yaml');
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 for invalid semver version', async () => {
    const yaml = loadFixture('valid-service.yaml').replace(
      'version: "1.0.0"',
      'version: "latest"',
    );
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('semver');
  });

  it('returns 409 for duplicate version', async () => {
    const yaml = loadFixture('valid-service.yaml');
    // First publish
    await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });

    // Same version again
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('VERSION_CONFLICT');
  });

  it('returns 403 for reserved namespace', async () => {
    const yaml = loadFixture('valid-service.yaml').replace(
      'namespace: testns',
      'namespace: compute',
    );
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 for another user\'s namespace', async () => {
    // First user publishes to "testns"
    const yaml = loadFixture('valid-service.yaml');
    await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });

    // Second user tries to publish to same namespace
    const user2 = createTestUser(ctx.db, {
      username: 'other',
      githubId: 3002,
    });
    const token2 = createTestJWT(ctx.authService, user2.id, user2.username);
    const yaml2 = loadFixture('valid-database.yaml');
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token2),
        'Content-Type': 'text/yaml',
      },
      body: yaml2,
    });
    expect(res.status).toBe(403);
  });

  it('auto-claims unclaimed namespace', async () => {
    const yaml = loadFixture('valid-service.yaml').replace(
      'namespace: testns',
      'namespace: mynewns',
    );
    const res = await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });
    expect(res.status).toBe(201);

    // Verify namespace created with correct owner
    const ns = ctx.db
      .prepare('SELECT * FROM namespaces WHERE name = ?')
      .get('mynewns') as { owner_id: number };
    expect(ns.owner_id).toBe(user.id);
  });

  it('published NodeDef appears in search', async () => {
    const yaml = loadFixture('valid-service.yaml');
    await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });

    const searchRes = await ctx.app.request(
      '/api/v1/nodedefs?q=service',
    );
    const body = await searchRes.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    const found = body.items.find(
      (i: { name: string }) => i.name === 'service',
    );
    expect(found).toBeDefined();
  });

  it('published NodeDef is fetchable via GET', async () => {
    const yaml = loadFixture('valid-service.yaml');
    await ctx.app.request('/api/v1/nodedefs', {
      method: 'POST',
      headers: {
        ...authHeader(token),
        'Content-Type': 'text/yaml',
      },
      body: yaml,
    });

    const getRes = await ctx.app.request(
      '/api/v1/nodedefs/testns/service',
    );
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.nodeDef.metadata.name).toBe('service');
  });
});
