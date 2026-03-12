import { computeYamls } from './compute';
import { dataYamls } from './data';
import { messagingYamls } from './messaging';
import { networkYamls } from './network';
import { clientYamls } from './client';
import { integrationYamls } from './integration';
import { securityYamls } from './security';
import { observabilityYamls } from './observability';
import { aiYamls } from './ai';

export const builtinYamlStrings: string[] = [
  ...computeYamls,
  ...dataYamls,
  ...messagingYamls,
  ...networkYamls,
  ...clientYamls,
  ...integrationYamls,
  ...securityYamls,
  ...observabilityYamls,
  ...aiYamls,
];
