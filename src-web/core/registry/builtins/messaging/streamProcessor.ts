import type { NodeDef } from '../../../../types/nodeDefSchema';

export const streamProcessorDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'stream-processor',
    namespace: 'messaging',
    version: '1.0.0',
    displayName: 'Stream Processor',
    description:
      'Real-time stream processing engine for continuous data transformation and aggregation.',
    icon: 'GitBranch',
    tags: ['streaming', 'realtime'],
    shape: 'hexagon',
  },
  spec: {
    args: [
      {
        name: 'engine',
        type: 'enum',
        options: ['Kafka Streams', 'Flink', 'Spark Streaming', 'Kinesis'],
        description:
          'Stream processing engine or framework.',
      },
      {
        name: 'parallelism',
        type: 'number',
        default: 1,
        description:
          'Degree of parallelism for stream processing tasks.',
      },
    ],
    ports: [
      {
        name: 'stream-in',
        direction: 'inbound',
        protocol: ['Stream', 'Kafka'],
        description:
          'Inbound port for ingesting data streams.',
      },
      {
        name: 'stream-out',
        direction: 'outbound',
        protocol: ['Stream', 'Kafka'],
        description:
          'Outbound port for emitting processed stream results.',
      },
      {
        name: 'state-out',
        direction: 'outbound',
        protocol: ['State'],
        description:
          'Outbound port for externalizing processor state (e.g., materialized views).',
      },
    ],
    ai: {
      context:
        'A stream processor performs continuous, real-time transformations on unbounded data streams. It may maintain internal state for windowed aggregations or joins. Key review areas include checkpointing, exactly-once semantics, and backpressure handling.',
      reviewHints: [
        'Verify checkpointing and state recovery strategy to prevent data loss on failures.',
        'Ensure backpressure mechanisms are in place to handle upstream throughput spikes.',
        'Review windowing and watermark configuration for correct handling of late-arriving events.',
      ],
    },
  },
};
