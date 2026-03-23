import type { NodeDef } from '../../../../types/nodeDefSchema';

export const cacheDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'cache',
    namespace: 'data',
    version: '1.0.0',
    displayName: 'Cache',
    description:
      'In-memory key-value cache for low-latency reads and reducing backend load.',
    icon: 'MemoryStick',
    tags: ['caching', 'performance'],
    shape: 'cylinder',
  },
  spec: {
    args: [
      {
        name: 'engine',
        type: 'enum',
        required: true,
        options: ['Redis', 'Memcached', 'Valkey'],
        description: 'Cache engine type.',
      },
      {
        name: 'maxMemory',
        type: 'string',
        required: false,
        default: '256mb',
        description:
          'Maximum memory allocation (e.g. 256mb, 1gb).',
      },
      {
        name: 'eviction',
        type: 'enum',
        required: false,
        options: ['lru', 'lfu', 'random', 'ttl'],
        default: 'lru',
        description:
          'Key eviction policy when memory limit is reached.',
      },
    ],
    ports: [
      {
        name: 'cache-in',
        direction: 'inbound',
        protocol: ['Redis', 'Memcached'],
        description:
          'Accepts cache read/write requests from application services.',
      },
      {
        name: 'cache-out',
        direction: 'outbound',
        protocol: ['Redis', 'Memcached'],
        description:
          'Forwards cache invalidation or replication to downstream caches.',
      },
    ],
    children: [],
    ai: {
      context:
        'Volatile in-memory store. Assume data can be lost at any time; never treat as durable storage.',
      reviewHints: [
        'Confirm that a cache-miss path exists back to the primary data source.',
        'Verify eviction policy aligns with access patterns (lru for recency, lfu for frequency).',
        'Check that maxMemory is sized to avoid excessive swapping under peak load.',
      ],
    },
  },
};
