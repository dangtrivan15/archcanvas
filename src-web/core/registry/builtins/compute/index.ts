import type { NodeDef } from '../../../../types/nodeDefSchema';
import { serviceDef } from './service';
import { functionDef } from './function';
import { workerDef } from './worker';
import { containerDef } from './container';
import { cronJobDef } from './cronJob';

export const computeDefs: NodeDef[] = [
  serviceDef,
  functionDef,
  workerDef,
  containerDef,
  cronJobDef,
];
