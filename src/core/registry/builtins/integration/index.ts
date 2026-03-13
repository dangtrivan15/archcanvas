import type { NodeDef } from '../../../../types/nodeDefSchema';
import { thirdPartyApiDef } from './thirdPartyApi';
import { webhookDef } from './webhook';
import { etlPipelineDef } from './etlPipeline';

export const integrationDefs: NodeDef[] = [
  thirdPartyApiDef,
  webhookDef,
  etlPipelineDef,
];
