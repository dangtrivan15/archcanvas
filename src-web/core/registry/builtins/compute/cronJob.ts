import type { NodeDef } from '../../../../types/nodeDefSchema';

export const cronJobDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'cron-job',
    namespace: 'compute',
    version: '1.0.0',
    displayName: 'Cron Job',
    description:
      'A scheduled task that runs on a cron schedule to perform periodic batch processing or maintenance.',
    icon: 'Clock',
    tags: ['scheduled', 'batch'],
    shape: 'trapezoid',
  },
  spec: {
    args: [
      {
        name: 'schedule',
        type: 'string',
        default: '0 * * * *',
        description:
          'Cron expression defining the execution schedule.',
      },
      {
        name: 'timezone',
        type: 'string',
        default: 'UTC',
        description:
          'Timezone for interpreting the cron schedule.',
      },
    ],
    ports: [
      {
        name: 'trigger-out',
        direction: 'outbound',
        protocol: ['HTTP', 'Event'],
        description:
          'Triggers downstream services or functions on each scheduled execution.',
      },
    ],
    ai: {
      context:
        'A cron job is a time-triggered compute unit for periodic tasks. Review its schedule frequency, timezone handling, and whether the triggered downstream systems can tolerate overlapping or missed executions.',
      reviewHints: [
        'Verify that the cron schedule frequency matches the actual business requirement to avoid unnecessary executions.',
        'Ensure the job has idempotency or mutual-exclusion guarantees if executions could overlap.',
        'Check that the timezone setting is intentional, especially for schedules sensitive to daylight saving transitions.',
      ],
    },
  },
};
