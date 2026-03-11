/**
 * Dialog component registry.
 *
 * A simple Map-based registry where dialog components self-register at import time.
 * No dynamic loading — all dialogs are statically imported and registered.
 */

import type { DialogConfig } from './types';

/** Internal registry map: dialog ID -> DialogConfig */
const registry = new Map<string, DialogConfig>();

/**
 * Register a dialog component in the registry.
 * Dialogs call this at import time (module-level side effect).
 */
export function registerDialog(config: DialogConfig): void {
  if (registry.has(config.id)) {
    console.warn(`[DialogRegistry] Dialog "${config.id}" is already registered. Overwriting.`);
  }
  registry.set(config.id, config);
}

/**
 * Look up a dialog component by ID.
 * Returns undefined if the dialog is not registered.
 */
export function getDialog(id: string): DialogConfig | undefined {
  return registry.get(id);
}

/**
 * Get all registered dialog IDs (useful for debugging/testing).
 */
export function getRegisteredDialogIds(): string[] {
  return Array.from(registry.keys());
}

/**
 * Get all registered dialog configs (for unconditional rendering).
 * Dialogs self-manage visibility via their own `open` state.
 */
export function getRegisteredDialogs(): DialogConfig[] {
  return Array.from(registry.values());
}

/**
 * Clear the registry (for testing only).
 */
export function clearRegistry(): void {
  registry.clear();
}
