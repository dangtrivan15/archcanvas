import type { NodeDef } from '../../../../types/nodeDefSchema';

export const thirdPartyApiDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'third-party-api',
    namespace: 'integration',
    version: '1.0.0',
    displayName: 'Third-Party API',
    description:
      'External API integration point for consuming or exposing services via REST or GraphQL.',
    icon: 'ExternalLink',
    tags: ['external', 'api', 'integration'],
    shape: 'cloud',
  },
  spec: {
    args: [
      {
        name: 'provider',
        type: 'string',
        required: true,
        description:
          'Name of the external API provider (e.g. Stripe, Twilio, GitHub).',
      },
      {
        name: 'authMethod',
        type: 'enum',
        options: ['api-key', 'oauth2', 'basic', 'none'],
        default: 'api-key',
        description:
          'Authentication method used to connect to the external API.',
      },
      {
        name: 'baseUrl',
        type: 'string',
        required: true,
        description:
          'Base URL of the external API endpoint.',
      },
    ],
    ports: [
      {
        name: 'api-in',
        direction: 'inbound',
        protocol: ['HTTP', 'HTTPS'],
        description:
          'Incoming requests to the API integration.',
      },
      {
        name: 'api-out',
        direction: 'outbound',
        protocol: ['HTTP', 'HTTPS'],
        description:
          'Outgoing calls to the external API provider.',
      },
    ],
    ai: {
      context:
        'Represents a dependency on an external third-party service. Review for availability risks, rate-limit handling, authentication security, and data-boundary compliance.',
      reviewHints: [
        'Verify that secrets (API keys, OAuth tokens) are not hardcoded and are managed via a secrets store.',
        'Check for retry and circuit-breaker logic to handle transient failures from the external provider.',
        'Ensure request/response payloads are validated to prevent injection or data-leak vulnerabilities.',
      ],
    },
  },
  variants: [
    {
      name: 'REST API',
      description:
        'Standard RESTful API integration with JSON payloads.',
      args: { authMethod: 'api-key' },
    },
    {
      name: 'GraphQL API',
      description:
        'GraphQL API integration with query/mutation support.',
      args: { authMethod: 'oauth2' },
    },
  ],
};
