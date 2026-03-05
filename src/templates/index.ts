/**
 * Template Metadata & Storage — Public API
 *
 * Exports types, registry functions, and storage CRUD operations.
 */

// Types
export type { TemplateMetadata, TemplateRecord } from './types';

// Registry (built-in + imported)
export {
  getBuiltinTemplates,
  getAllTemplates,
  getTemplateById,
  getAllTemplateMetadata,
  clearBuiltinCache,
} from './registry';

// Storage (IndexedDB for imported templates)
export type { ImportedTemplateRecord } from './storage';
export {
  saveImportedTemplate,
  getImportedTemplates,
  getImportedTemplateById,
  deleteImportedTemplate,
  getImportedTemplateCount,
  clearImportedTemplates,
} from './storage';
