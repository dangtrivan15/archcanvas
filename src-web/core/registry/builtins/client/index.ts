import type { NodeDef } from '../../../../types/nodeDefSchema';
import { webAppDef } from './webApp';
import { mobileAppDef } from './mobileApp';
import { cliDef } from './cli';

export const clientDefs: NodeDef[] = [
  webAppDef,
  mobileAppDef,
  cliDef,
];
