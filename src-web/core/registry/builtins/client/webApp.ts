import type { NodeDef } from '../../../../types/nodeDefSchema';

export const webAppDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'web-app',
    namespace: 'client',
    version: '1.0.0',
    displayName: 'Web Application',
    description:
      'A browser-based web application serving a user interface over HTTP.',
    icon: 'Monitor',
    tags: ['frontend', 'web', 'spa'],
    shape: 'rounded-rect',
  },
  spec: {
    args: [
      {
        name: 'framework',
        type: 'enum',
        options: ['React', 'Vue', 'Angular', 'Svelte', 'Next.js'],
        required: true,
        description:
          'Front-end framework used to build the application.',
      },
      {
        name: 'language',
        type: 'enum',
        options: ['TypeScript', 'JavaScript'],
        default: 'TypeScript',
        required: false,
        description: 'Primary programming language.',
      },
    ],
    ports: [
      {
        name: 'http-out',
        direction: 'outbound',
        protocol: ['HTTP', 'HTTPS'],
        description:
          'Outbound HTTP/HTTPS requests to backend services.',
      },
      {
        name: 'ws-out',
        direction: 'outbound',
        protocol: ['WebSocket'],
        description:
          'Outbound WebSocket connections for real-time communication.',
      },
    ],
    ai: {
      context:
        'A web application node represents a browser-based frontend that users interact with directly. It typically communicates with backend services via HTTP APIs or WebSocket connections.',
      reviewHints: [
        "Verify that the chosen framework aligns with the team's expertise and project requirements.",
        'Ensure outbound HTTP connections point to valid API or gateway nodes.',
        'Consider whether SSR vs SPA impacts latency and SEO requirements.',
      ],
    },
  },
  variants: [
    {
      name: 'SPA',
      description:
        'Single-page application rendered entirely in the browser.',
      args: { framework: 'React' },
    },
    {
      name: 'SSR',
      description:
        'Server-side rendered application with hydration on the client.',
      args: { framework: 'Next.js' },
    },
  ],
};
