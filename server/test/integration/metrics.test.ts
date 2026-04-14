import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestContext } from '../helpers/testApp';
import { createTestUser, createTestJWT } from '../helpers/testAuth';
import { publishFixture } from '../helpers/testFixtures';

describe('Metrics', () => {
  let ctx: TestContext;
  let token: string;

  beforeEach(async () => {
    ctx = createTestApp();
    const user = createTestUser(ctx.db, {
      username: 'metricuser',
      githubId: 5001,
    });
    token = createTestJWT(ctx.authService, user.id, user.username);
    await publishFixture(ctx.app, token, 'valid-service.yaml');
  });

  it('increments download count on fetch', async () => {
    // Initial state
    let row = ctx.db
      .prepare(
        "SELECT total_downloads FROM nodedefs WHERE namespace = 'testns' AND name = 'service'",
      )
      .get() as { total_downloads: number };
    const initialDownloads = row.total_downloads;

    // Fetch the NodeDef with a unique IP
    await ctx.app.request('/api/v1/nodedefs/testns/service', {
      headers: { 'x-forwarded-for': '10.10.10.10' },
    });

    row = ctx.db
      .prepare(
        "SELECT total_downloads FROM nodedefs WHERE namespace = 'testns' AND name = 'service'",
      )
      .get() as { total_downloads: number };
    expect(row.total_downloads).toBe(initialDownloads + 1);
  });

  it('tracks per-version downloads', async () => {
    await ctx.app.request('/api/v1/nodedefs/testns/service', {
      headers: { 'x-forwarded-for': '10.10.10.20' },
    });

    const versionRow = ctx.db
      .prepare(
        `SELECT downloads FROM nodedef_versions v
        JOIN nodedefs n ON n.id = v.nodedef_id
        WHERE n.namespace = 'testns' AND n.name = 'service' AND v.version = '1.0.0'`,
      )
      .get() as { downloads: number };
    expect(versionRow.downloads).toBeGreaterThanOrEqual(1);
  });

  it('deduplicates downloads from same IP within 1 hour', async () => {
    let currentTime = Date.now();
    // Create a new test context with controlled time
    const dedupCtx = createTestApp(undefined, () => currentTime);
    const user = createTestUser(dedupCtx.db, {
      username: 'dedupuser',
      githubId: 5002,
    });
    const dedupToken = createTestJWT(
      dedupCtx.authService,
      user.id,
      user.username,
    );
    await publishFixture(dedupCtx.app, dedupToken, 'valid-service.yaml');

    // First fetch — should increment
    await dedupCtx.app.request('/api/v1/nodedefs/testns/service', {
      headers: { 'x-forwarded-for': '10.10.10.30' },
    });

    // Second fetch — same IP, same hour — should NOT increment
    await dedupCtx.app.request('/api/v1/nodedefs/testns/service', {
      headers: { 'x-forwarded-for': '10.10.10.30' },
    });

    const row = dedupCtx.db
      .prepare(
        "SELECT total_downloads FROM nodedefs WHERE namespace = 'testns' AND name = 'service'",
      )
      .get() as { total_downloads: number };
    expect(row.total_downloads).toBe(1);

    // Advance time past 1 hour
    currentTime += 3600001;

    // Third fetch — should increment again
    await dedupCtx.app.request('/api/v1/nodedefs/testns/service', {
      headers: { 'x-forwarded-for': '10.10.10.30' },
    });

    const row2 = dedupCtx.db
      .prepare(
        "SELECT total_downloads FROM nodedefs WHERE namespace = 'testns' AND name = 'service'",
      )
      .get() as { total_downloads: number };
    expect(row2.total_downloads).toBe(2);
  });
});
