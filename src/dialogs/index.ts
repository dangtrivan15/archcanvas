/**
 * Dialog system public API.
 *
 * Re-exports the registry functions and types, plus the DialogHost component.
 * Importing this module triggers self-registration for all migrated dialog components.
 * Callers can use openDialog/closeDialog from the uiStore — this barrel
 * provides the infrastructure pieces.
 */

// Import each dialog to trigger self-registration via registerDialog()
import './DeleteConfirmationDialog';
import './ConnectionTypeDialog';
import './UnsavedChangesDialog';
import './ErrorDialog';
import './IntegrityWarningDialog';
import './ConflictDialog';
import './EmptyProjectDialog';

// Re-export the host component and registry utilities
export { DialogHost } from './DialogHost';
export { registerDialog, getDialog, getRegisteredDialogIds, clearRegistry } from './registry';
export type { DialogId, DialogPropsMap, DialogConfig } from './types';
