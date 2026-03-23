import type { NodeDef } from '../../../types/nodeDefSchema';
import { computeDefs } from './compute';
import { dataDefs } from './data';
import { messagingDefs } from './messaging';
import { networkDefs } from './network';
import { clientDefs } from './client';
import { integrationDefs } from './integration';
import { securityDefs } from './security';
import { observabilityDefs } from './observability';
import { aiDefs } from './ai';

export const builtinNodeDefs: NodeDef[] = [
  ...computeDefs,
  ...dataDefs,
  ...messagingDefs,
  ...networkDefs,
  ...clientDefs,
  ...integrationDefs,
  ...securityDefs,
  ...observabilityDefs,
  ...aiDefs,
];
