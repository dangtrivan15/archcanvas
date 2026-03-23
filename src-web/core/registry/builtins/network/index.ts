import type { NodeDef } from '../../../../types/nodeDefSchema';
import { apiGatewayDef } from './apiGateway';
import { loadBalancerDef } from './loadBalancer';
import { cdnDef } from './cdn';

export const networkDefs: NodeDef[] = [
  apiGatewayDef,
  loadBalancerDef,
  cdnDef,
];
