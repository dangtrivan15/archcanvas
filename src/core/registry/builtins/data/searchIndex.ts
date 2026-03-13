import type { NodeDef } from '../../../../types/nodeDefSchema';

export const searchIndexDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'search-index',
    namespace: 'data',
    version: '1.0.0',
    displayName: 'Search Index',
    description:
      'Full-text search and analytics engine for indexing and querying large datasets.',
    icon: 'Search',
    tags: ['search', 'indexing'],
    shape: 'cylinder',
  },
  spec: {
    args: [
      {
        name: 'engine',
        type: 'enum',
        required: true,
        options: ['Elasticsearch', 'OpenSearch', 'Typesense', 'Meilisearch'],
        description: 'Search engine type.',
      },
      {
        name: 'replicas',
        type: 'number',
        required: false,
        default: 1,
        description:
          'Number of index replicas for read throughput and fault tolerance.',
      },
    ],
    ports: [
      {
        name: 'index-in',
        direction: 'inbound',
        protocol: ['HTTP', 'REST'],
        description:
          'Accepts document indexing requests from data pipelines.',
      },
      {
        name: 'query-in',
        direction: 'inbound',
        protocol: ['HTTP', 'REST'],
        description:
          'Accepts search and aggregation queries from application services.',
      },
      {
        name: 'replication-out',
        direction: 'outbound',
        protocol: ['Replication'],
        description:
          'Replicates index shards to follower nodes for redundancy.',
      },
    ],
    children: [],
    ai: {
      context:
        'Secondary index derived from a primary data source. Treat as rebuildable; ensure a re-indexing strategy exists.',
      reviewHints: [
        'Verify that an indexing pipeline keeps the search index in sync with the source of truth.',
        'Check shard and replica counts against expected query volume and data size.',
        'Ensure mapping or schema changes have a zero-downtime migration plan.',
      ],
    },
  },
};
