/**
 * Maps React Flow edge type strings to edge components.
 */

import { SyncEdge } from './SyncEdge';
import { AsyncEdge } from './AsyncEdge';
import { DataFlowEdge } from './DataFlowEdge';

export const edgeTypes = {
  sync: SyncEdge,
  async: AsyncEdge,
  dataFlow: DataFlowEdge,
};
