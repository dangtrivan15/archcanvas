import type { NodeDef } from '../../../../types/nodeDefSchema';

export const loggingDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'logging',
    namespace: 'observability',
    version: '1.0.0',
    displayName: 'Logging',
    description:
      'Centralized log aggregation and search platform for collecting, storing, and querying application and infrastructure logs.',
    icon: 'FileText',
    tags: ['logging', 'logs', 'observability'],
    shape: 'document',
  },
  spec: {
    args: [
      {
        name: 'platform',
        type: 'enum',
        options: ['ELK', 'Loki', 'CloudWatch', 'Datadog'],
        required: true,
        description: 'Log aggregation platform or managed service.',
      },
      {
        name: 'retention',
        type: 'duration',
        default: '30d',
        description:
          'How long logs are retained before expiration.',
      },
      {
        name: 'format',
        type: 'enum',
        options: ['json', 'text'],
        default: 'json',
        description:
          'Structured log format used for ingestion.',
      },
    ],
    ports: [
      {
        name: 'log-in',
        direction: 'inbound',
        protocol: ['Syslog', 'HTTP', 'Fluentd'],
        description:
          'Ingestion endpoint for log streams from applications and collectors.',
      },
      {
        name: 'query-out',
        direction: 'outbound',
        protocol: ['HTTP', 'REST'],
        description:
          'Query interface for dashboards, alerting, or downstream consumers.',
      },
    ],
    ai: {
      context:
        'Represents a centralized logging system that ingests logs from multiple sources, indexes them for search, and exposes a query API. Common in observability stacks alongside metrics and tracing.',
      reviewHints: [
        'Verify that log retention aligns with compliance and cost requirements.',
        'Ensure structured (JSON) logging is used consistently across producers.',
        'Check that sensitive data is redacted or masked before ingestion.',
      ],
    },
  },
};
