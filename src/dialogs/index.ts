/**
 * Dialog system public API.
 *
 * Re-exports the registry functions and types, plus the DialogHost component.
 * Callers can use openDialog/closeDialog from the uiStore — this barrel
 * provides the infrastructure pieces.
 */

export { DialogHost } from './DialogHost';
export { registerDialog, getDialog, getRegisteredDialogIds, clearRegistry } from './registry';
export type { DialogId, DialogPropsMap, DialogConfig } from './types';
