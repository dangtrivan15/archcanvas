/**
 * ID generation using ULID (Universally Unique Lexicographically Sortable Identifier)
 */

import { ulid } from 'ulid';

export function generateId(): string {
  return ulid();
}
