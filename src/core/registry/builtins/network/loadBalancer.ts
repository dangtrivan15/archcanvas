import type { NodeDef } from '../../../../types/nodeDefSchema';

export const loadBalancerDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'load-balancer',
    namespace: 'network',
    version: '1.0.0',
    displayName: 'Load Balancer',
    description:
      'Distributes incoming traffic across multiple backend instances using configurable balancing algorithms.',
    icon: 'Scale',
    tags: ['balancing', 'traffic', 'ha'],
    shape: 'stadium',
  },
  spec: {
    args: [
      {
        name: 'algorithm',
        type: 'enum',
        options: ['round-robin', 'least-connections', 'ip-hash', 'weighted'],
        default: 'round-robin',
      },
      {
        name: 'healthCheck',
        type: 'boolean',
        default: true,
      },
    ],
    ports: [
      {
        name: 'traffic-in',
        direction: 'inbound',
        protocol: ['HTTP', 'HTTPS', 'TCP'],
      },
      {
        name: 'backend-out',
        direction: 'outbound',
        protocol: ['HTTP', 'HTTPS', 'TCP'],
      },
    ],
    ai: {
      context:
        'Load balancer distributing traffic across backend instances to ensure high availability and even resource utilization.',
      reviewHints: [
        'Confirm the balancing algorithm suits the workload pattern (stateless vs sticky sessions).',
        'Ensure health checks are enabled for production deployments to avoid routing to unhealthy backends.',
      ],
    },
  },
};
