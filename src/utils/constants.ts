/**
 * Application constants
 */

// File format
export const MAGIC_BYTES = new Uint8Array([0x41, 0x52, 0x43, 0x48, 0x43, 0x00]); // "ARCHC\0"
export const FORMAT_VERSION = 1;
export const FILE_EXTENSION = '.archc';
export const SIDECAR_EXTENSION = '.summary.md';

// Undo/redo
export const MAX_UNDO_ENTRIES = 100;

// Canvas
export const DEFAULT_NODE_WIDTH = 240;
export const DEFAULT_NODE_HEIGHT = 120;
export const GRID_SIZE = 20;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const FIT_VIEW_PADDING = 0.2;

// Layout
export const DEFAULT_NODE_SPACING_X = 200;
export const DEFAULT_NODE_SPACING_Y = 100;

// NodeDef namespaces
export const NODEDEF_NAMESPACES = [
  'compute',
  'data',
  'messaging',
  'network',
  'observability',
] as const;

export type NodeDefNamespace = (typeof NODEDEF_NAMESPACES)[number];

// Right panel tabs
// Note: Panel dimension constants (widths, min/max) live in src/store/uiStore.ts
export const RIGHT_PANEL_TABS = ['properties', 'notes', 'coderefs', 'aichat'] as const;
export type RightPanelTab = (typeof RIGHT_PANEL_TABS)[number];

// Default architecture
export const DEFAULT_ARCHITECTURE_NAME = 'Untitled Architecture';
