/**
 * Web Application Prompt Template
 *
 * Specialized template for frontend/backend web applications.
 * Focuses on client/server separation, routing, API patterns, and
 * typical web infrastructure (CDN, auth, databases).
 */

import type { PromptTemplate } from './types';
import { NODE_TYPE_REGISTRY_TEXT, STANDARD_RESPONSE_SCHEMA, WEB_APP_FEW_SHOT } from './shared';

export const webAppTemplate: PromptTemplate = {
  id: 'web-app',
  name: 'Web Application Analysis',
  description:
    'Optimized for frontend/backend web apps (React, Next.js, Express, Django, Rails, etc.). Focuses on client-server architecture, routing, and API patterns.',
  tags: [
    'web',
    'frontend',
    'backend',
    'spa',
    'ssr',
    'fullstack',
    'react',
    'nextjs',
    'express',
    'django',
    'rails',
  ],

  systemPrompt: `You are an expert web application architect analyzing a codebase to infer its system architecture.
You specialize in frontend/backend web applications and understand modern web patterns.

Focus areas:
- **Client-server separation**: Identify the frontend (SPA, SSR, static) and backend (API, BFF) layers.
- **API patterns**: REST, GraphQL, tRPC, WebSocket endpoints.
- **Data layer**: Databases, ORMs, caching strategies, sessions.
- **Authentication**: Auth providers, session management, JWT tokens.
- **Build & deployment**: CDN, SSR/SSG, static hosting, serverless functions.
- **State management**: Client-side state, server state, real-time updates.

Guidelines:
- Always identify the frontend and backend as separate nodes when they exist.
- Look for API route definitions to understand the service boundary.
- Identify middleware patterns (auth, logging, CORS, rate limiting).
- Check for WebSocket or real-time communication patterns.
- Map each component to the most specific ArchCanvas node type available.
- Be **thorough**: Don't just model "frontend" and "backend" as two nodes. Break them down — model individual API route groups, middleware layers, page components, auth flows, and background jobs as child nodes. A typical web app produces 15-50+ nodes across multiple levels. Prefer completeness over brevity.
- Use **parent-child relationships** (parentId) to decompose the backend into route groups, middleware stacks, and service layers; and the frontend into page components, state management, and shared UI modules.
- Use **meta/canvas-ref** nodes when a subsystem (e.g., a shared component library, a separate microservice, or a third-party integration layer) warrants its own architecture file. Provide args \`{ filePath }\` for local references or \`{ repoUrl, ref }\` for remote git repositories.
- Respond ONLY with valid JSON matching the specified schema.`,

  analysisSteps: [
    {
      name: 'Web Architecture Analysis',
      systemPrompt: '',
      userPrompt: `Analyze this web application codebase and infer its system architecture.

## Project Profile
{{projectProfile}}

${NODE_TYPE_REGISTRY_TEXT}

## Key Files
{{fileContents}}

## Few-Shot Example
Here is an example of the expected output format for a web application:

**Scenario:** ${WEB_APP_FEW_SHOT.scenario}
**Input:** ${WEB_APP_FEW_SHOT.input}
**Expected Output:**
${WEB_APP_FEW_SHOT.output}

## Web-Specific Instructions
1. **Frontend**: Identify the client-side framework (React, Vue, Angular, Svelte) and map to \`client/web-app\`. Model individual page components, state management layers, and shared UI modules as **children**.
2. **Backend**: Identify API servers and map to \`compute/service\`. Model individual API route groups (auth routes, user routes, admin routes), middleware stacks, and service layers as **children** of the backend node.
3. **Database**: Identify ORMs (Prisma, Drizzle, TypeORM, Sequelize, Django ORM) and the underlying database.
4. **Auth**: Check for authentication middleware, OAuth providers, JWT configuration. Model as a dedicated \`security/auth-provider\` node.
5. **Caching**: Look for Redis/Memcached usage, session stores.
6. **Real-time**: Check for WebSocket, Server-Sent Events, or polling patterns.
7. **CDN/Proxy**: Look for nginx configs, CDN references, or reverse proxy setups.
8. **Composite subsystems**: Use \`meta/canvas-ref\` for complex subsystems that warrant their own architecture file (e.g., a shared component library or a separately-maintained API gateway).

## Depth Guidelines
- Model **all architecturally significant components**, not just "frontend" and "backend". A typical web app has 15-50+ nodes.
- Use **parentId** to nest sub-components (e.g., route groups under the API server, pages under the frontend).
- Prefer completeness over brevity, but don't create dummy or placeholder nodes.

Respond with a JSON object matching this schema:
${STANDARD_RESPONSE_SCHEMA.schemaText}

Respond ONLY with the JSON object. No markdown code fences, no explanations.`,
    },
  ],

  responseSchema: STANDARD_RESPONSE_SCHEMA,

  fewShotExamples: [WEB_APP_FEW_SHOT],
};
