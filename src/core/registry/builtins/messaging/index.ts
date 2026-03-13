import type { NodeDef } from '../../../../types/nodeDefSchema';
import { messageQueueDef } from './messageQueue';
import { eventBusDef } from './eventBus';
import { streamProcessorDef } from './streamProcessor';
import { notificationDef } from './notification';

export const messagingDefs: NodeDef[] = [
  messageQueueDef,
  eventBusDef,
  streamProcessorDef,
  notificationDef,
];
