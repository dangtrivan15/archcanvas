import type { NodeDef } from '../../../../types/nodeDefSchema';

export const agentDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'agent',
    namespace: 'ai',
    version: '1.0.0',
    displayName: 'Agent',
    description:
      'Autonomous AI agent capable of multi-step reasoning and tool use',
    icon: 'Bot',
    tags: ['ai', 'agent', 'autonomous'],
    shape: 'hexagon',
  },
  spec: {
    args: [
      {
        name: 'framework',
        type: 'enum',
        options: ['LangChain', 'CrewAI', 'AutoGen', 'Custom'],
        required: true,
      },
      {
        name: 'model',
        type: 'string',
        default: 'gpt-4',
      },
      {
        name: 'maxSteps',
        type: 'number',
        default: 10,
      },
    ],
    ports: [
      {
        name: 'task-in',
        direction: 'inbound',
        protocol: ['HTTP', 'Event'],
      },
      {
        name: 'tool-out',
        direction: 'outbound',
        protocol: ['HTTP', 'HTTPS'],
      },
      {
        name: 'llm-out',
        direction: 'outbound',
        protocol: ['HTTP', 'HTTPS'],
      },
    ],
    ai: {
      context:
        'An autonomous agent that receives tasks, reasons through multi-step plans, invokes external tools, and queries language models to produce results.',
      reviewHints: [
        'Ensure maxSteps is bounded to prevent runaway execution loops',
        'Verify that tool-out connections point to endpoints the agent is authorized to invoke',
        'Confirm the selected framework version is compatible with the specified model',
      ],
    },
  },
};
