import { Hono } from 'hono';
import type { NodeDefService } from '../services/nodeDefService';
import type { AuthService } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { SearchQuerySchema, FetchQuerySchema, validateRequest } from '../validation/querySchemas';
import { ValidationError } from '../middleware/errorHandler';
import type { Pagination } from '../repositories/types';
import type { AppEnv } from '../types';

interface RoutesDeps {
  nodeDefService: NodeDefService;
  authService: AuthService;
}

export function createNodeDefRoutes(deps: RoutesDeps): Hono<AppEnv> {
  const { nodeDefService, authService } = deps;
  const app = new Hono<AppEnv>();

  // GET /api/v1/nodedefs — Search / list
  app.get('/api/v1/nodedefs', (c) => {
    const rawQuery: Record<string, unknown> = {};
    const url = new URL(c.req.url);
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'tag') {
        const existing = rawQuery.tag;
        if (Array.isArray(existing)) {
          (existing as string[]).push(value);
        } else if (typeof existing === 'string') {
          rawQuery.tag = [existing, value];
        } else {
          rawQuery.tag = value;
        }
      } else {
        rawQuery[key] = value;
      }
    }

    const parsed = validateRequest(SearchQuerySchema, rawQuery);
    if ('error' in parsed) {
      throw new ValidationError(parsed.error);
    }

    const { q, namespace, tag, sort, page, pageSize } = parsed.data;

    // Normalize tags to array
    const tags = tag
      ? Array.isArray(tag)
        ? tag
        : [tag]
      : undefined;

    const pagination: Pagination = {
      page: page || 1,
      pageSize: pageSize || 20,
      sort: sort || (q ? 'relevance' : 'recent'),
    };

    const result = nodeDefService.search(
      q || null,
      { namespace, tags },
      pagination,
    );

    return c.json({
      items: result.items,
      total: result.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  });

  // GET /api/v1/nodedefs/:namespace/:name — Fetch single NodeDef
  app.get('/api/v1/nodedefs/:namespace/:name', (c) => {
    const namespace = c.req.param('namespace');
    const name = c.req.param('name');

    const queryParsed = validateRequest(FetchQuerySchema, {
      version: c.req.query('version'),
      format: c.req.query('format'),
    });

    if ('error' in queryParsed) {
      throw new ValidationError(queryParsed.error);
    }

    const { version, format } = queryParsed.data;
    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const record = nodeDefService.fetch(namespace, name, version, clientIp);

    if (!record) {
      return c.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: `NodeDef ${namespace}/${name}${version ? `@${version}` : ''} not found`,
          },
        },
        404,
      );
    }

    if (format === 'yaml') {
      return new Response(record.yamlBlob, {
        status: 200,
        headers: {
          'Content-Type': 'text/yaml',
          'X-Registry-Publisher': record.publisher.username,
          'X-Registry-Version': record.versions[0] || '',
          'X-Registry-Downloads': String(record.downloads.total),
        },
      });
    }

    return c.json({
      nodeDef: record.nodeDef,
      registry: {
        publisher: record.publisher,
        versions: record.versions,
        downloads: record.downloads,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  });

  // POST /api/v1/nodedefs — Publish (authenticated)
  app.post('/api/v1/nodedefs', requireAuth(authService), async (c) => {
    const user = c.get('user');

    let yamlContent: string;
    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('text/yaml') || contentType.includes('text/x-yaml')) {
      yamlContent = await c.req.text();
    } else {
      let body: { yaml?: string };
      try {
        body = await c.req.json() as { yaml?: string };
      } catch {
        throw new ValidationError('Request body must be valid JSON');
      }
      if (!body.yaml) {
        throw new ValidationError('Request body must contain a "yaml" field');
      }
      yamlContent = body.yaml;
    }

    const result = nodeDefService.publish(yamlContent, user.userId);

    return c.json(
      {
        namespace: result.namespace,
        name: result.name,
        version: result.version,
        message: 'Published successfully',
      },
      201,
    );
  });

  return app;
}
