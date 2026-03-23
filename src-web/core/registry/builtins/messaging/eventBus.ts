import type { NodeDef } from '../../../../types/nodeDefSchema';

export const eventBusDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'event-bus',
    namespace: 'messaging',
    version: '1.0.0',
    displayName: 'Event Bus',
    description:
      'Central event bus for publishing and subscribing to domain events across services.',
    icon: 'Radio',
    tags: ['events', 'pubsub'],
    shape: 'parallelogram',
  },
  spec: {
    args: [
      {
        name: 'platform',
        type: 'enum',
        options: ['EventBridge', 'Kafka', 'NATS', 'Pulsar'],
        description: 'Event bus platform or managed service.',
      },
      {
        name: 'partitions',
        type: 'number',
        default: 1,
        description:
          'Number of partitions for parallel event processing.',
      },
    ],
    ports: [
      {
        name: 'publish-in',
        direction: 'inbound',
        protocol: ['Event'],
        description:
          'Inbound port for publishing events to the bus.',
      },
      {
        name: 'subscribe-out',
        direction: 'outbound',
        protocol: ['Event'],
        description:
          'Outbound port for delivering events to subscribers.',
      },
    ],
    ai: {
      context:
        'An event bus enables loosely coupled, event-driven architectures by routing domain events from publishers to subscribers. Partitioning controls parallelism and ordering scope. Review event schema evolution strategy and consider idempotent consumers.',
      reviewHints: [
        'Confirm event schema versioning strategy to handle backward-compatible evolution.',
        'Validate that partition count supports the expected throughput and ordering requirements.',
        'Check for idempotent consumer handling to prevent duplicate event processing.',
      ],
    },
  },
};
