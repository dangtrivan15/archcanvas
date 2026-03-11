/**
 * ESM Loader Registration for CLI.
 *
 * Registers the YAML loader hooks with Node.js's module system.
 * Used via: node --import ./src/cli/register-yaml.mjs ...
 * Or via tsx: npx tsx --import ./src/cli/register-yaml.mjs src/cli/index.ts
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./yaml-hooks.mjs', import.meta.url);
