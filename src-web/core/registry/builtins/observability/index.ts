import type { NodeDef } from '../../../../types/nodeDefSchema';
import { loggingDef } from './logging';
import { monitoringDef } from './monitoring';
import { tracingDef } from './tracing';

export const observabilityDefs: NodeDef[] = [
  loggingDef,
  monitoringDef,
  tracingDef,
];
