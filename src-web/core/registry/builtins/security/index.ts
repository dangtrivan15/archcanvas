import type { NodeDef } from '../../../../types/nodeDefSchema';
import { authProviderDef } from './authProvider';
import { vaultDef } from './vault';
import { wafDef } from './waf';

export const securityDefs: NodeDef[] = [
  authProviderDef,
  vaultDef,
  wafDef,
];
