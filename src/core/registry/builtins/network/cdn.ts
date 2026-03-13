import type { NodeDef } from '../../../../types/nodeDefSchema';

export const cdnDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'cdn',
    namespace: 'network',
    version: '1.0.0',
    displayName: 'CDN',
    description:
      'Content delivery network that caches and serves content from edge locations close to end users.',
    icon: 'Cloud',
    tags: ['cdn', 'edge', 'caching'],
    shape: 'cloud',
  },
  spec: {
    args: [
      {
        name: 'provider',
        type: 'enum',
        options: ['CloudFront', 'Cloudflare', 'Akamai', 'Fastly'],
      },
      {
        name: 'cacheTtl',
        type: 'duration',
        default: '1h',
      },
    ],
    ports: [
      {
        name: 'origin-in',
        direction: 'inbound',
        protocol: ['HTTP', 'HTTPS'],
      },
      {
        name: 'edge-out',
        direction: 'outbound',
        protocol: ['HTTP', 'HTTPS'],
      },
    ],
    ai: {
      context:
        'CDN edge node caching static and dynamic content to reduce latency and offload traffic from the origin server.',
      reviewHints: [
        'Verify cache TTL balances freshness requirements against origin load reduction.',
        'Ensure cache invalidation strategy is defined for content that changes frequently.',
        'Check that sensitive or personalized content is excluded from edge caching.',
      ],
    },
  },
};
