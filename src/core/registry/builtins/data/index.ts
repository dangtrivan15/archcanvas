import type { NodeDef } from '../../../../types/nodeDefSchema';
import { databaseDef } from './database';
import { cacheDef } from './cache';
import { objectStorageDef } from './objectStorage';
import { searchIndexDef } from './searchIndex';

export const dataDefs: NodeDef[] = [
  databaseDef,
  cacheDef,
  objectStorageDef,
  searchIndexDef,
];
