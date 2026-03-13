import type { NodeDef } from '../../../../types/nodeDefSchema';
import { llmProviderDef } from './llmProvider';
import { vectorStoreDef } from './vectorStore';
import { agentDef } from './agent';
import { ragPipelineDef } from './ragPipeline';

export const aiDefs: NodeDef[] = [
  llmProviderDef,
  vectorStoreDef,
  agentDef,
  ragPipelineDef,
];
