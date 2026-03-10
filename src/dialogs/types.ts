/**
 * Dialog registry types.
 *
 * DialogId is a string literal union of all known dialog IDs.
 * DialogPropsMap maps each ID to its specific props interface.
 * DialogConfig describes a registered dialog component.
 */

import type { ComponentType } from 'react';
import type {
  DeleteDialogInfo,
  ConnectionDialogInfo,
  UnsavedChangesDialogInfo,
  ErrorDialogInfo,
  IntegrityWarningDialogInfo,
  ConflictDialogInfo,
  EmptyProjectDialogInfo,
  ExternalAgentDialogInfo,
} from '@/store/uiStore';

/** Known dialog IDs — extensible string literal union */
export type DialogId =
  | 'delete'
  | 'connection'
  | 'unsavedChanges'
  | 'error'
  | 'integrityWarning'
  | 'conflict'
  | 'emptyProject'
  | 'externalAgent'
  | 'shortcutsHelp'
  | 'commandPalette'
  | 'quickSearch'
  | 'shortcutSettings'
  | 'settings'
  | 'templatePicker'
  | 'templateGallery'
  // Allow arbitrary string IDs for extensibility
  | (string & {});

/** Maps each dialog ID to its props type (the existing info interfaces) */
export interface DialogPropsMap {
  delete: DeleteDialogInfo;
  connection: ConnectionDialogInfo;
  unsavedChanges: UnsavedChangesDialogInfo;
  error: ErrorDialogInfo;
  integrityWarning: IntegrityWarningDialogInfo;
  conflict: ConflictDialogInfo;
  emptyProject: EmptyProjectDialogInfo;
  externalAgent: ExternalAgentDialogInfo;
  shortcutsHelp: Record<string, never>;
  commandPalette: Record<string, never>;
  quickSearch: Record<string, never>;
  shortcutSettings: Record<string, never>;
  settings: Record<string, never>;
  templatePicker: Record<string, never>;
  templateGallery: Record<string, never>;
}

/** Configuration for a registered dialog component */
export interface DialogConfig {
  /** Unique dialog identifier */
  id: string;
  /** React component to render when this dialog is open */
  component: ComponentType;
}
