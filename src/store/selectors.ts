/**
 * Zustand Store Selectors
 *
 * Centralized, granular selectors for all stores.
 * Use these instead of inline arrow functions to:
 *   1. Avoid re-creating selector references on every render
 *   2. Enable selector reuse across components
 *   3. Keep derived/computed logic out of components
 *
 * Usage:
 *   import { selectNodeCount, selectIsDirty } from '@/store/selectors';
 *   const nodeCount = useGraphStore(selectNodeCount);
 *   const isDirty = useGraphStore(selectIsDirty);
 */

import type { GraphStoreState } from './graphStore';
import type { FileStoreState } from './fileStore';
import type { EngineStoreState } from './engineStore';
import type { HistoryStoreState } from './historyStore';
import type { CanvasStoreState } from './canvasStore';
import type { UIStoreState } from './uiStore';
import type { NavigationStoreState } from './navigationStore';
import type { AnnotationStoreState } from './annotationStore';
// ─── Graph Store Selectors ───────────────────────────────────

/** Select the full architecture graph */
export const selectGraph = (s: GraphStoreState) => s.graph;

/** Select whether the document has unsaved changes */
export const selectIsDirty = (s: GraphStoreState) => s.isDirty;

/** Derived: total node count (includes children) */
export const selectNodeCount = (s: GraphStoreState) => s.nodeCount;

/** Derived: total edge count */
export const selectEdgeCount = (s: GraphStoreState) => s.edgeCount;

// ─── File Store Selectors ────────────────────────────────────

/** Select the current file name */
export const selectFileName = (s: FileStoreState) => s.fileName;

/** Select whether a save operation is in progress */
export const selectIsSaving = (s: FileStoreState) => s.isSaving;

// ─── Engine Store Selectors ──────────────────────────────────

/** Select whether core engines are initialized */
export const selectInitialized = (s: EngineStoreState) => s.initialized;

/** Select the registry instance */
export const selectRegistry = (s: EngineStoreState) => s.registry;

/** Select the render API instance */
export const selectRenderApi = (s: EngineStoreState) => s.renderApi;

/** Select the export API instance */
export const selectExportApi = (s: EngineStoreState) => s.exportApi;

// ─── History Store Selectors ─────────────────────────────────

/** Select undo availability */
export const selectCanUndo = (s: HistoryStoreState) => s.canUndo;

/** Select redo availability */
export const selectCanRedo = (s: HistoryStoreState) => s.canRedo;

// ─── Canvas Store Selectors ───────────────────────────────────

/** Select the currently selected node ID (single-select, backward compat) */
export const selectSelectedNodeId = (s: CanvasStoreState) => s.selectedNodeId;

/** Select the currently selected edge ID (single-select, backward compat) */
export const selectSelectedEdgeId = (s: CanvasStoreState) => s.selectedEdgeId;

/** Select all selected node IDs (multi-select) */
export const selectSelectedNodeIds = (s: CanvasStoreState) => s.selectedNodeIds;

/** Select all selected edge IDs (multi-select) */
export const selectSelectedEdgeIds = (s: CanvasStoreState) => s.selectedEdgeIds;

/** Select the canvas viewport (x, y, zoom) */
export const selectViewport = (s: CanvasStoreState) => s.viewport;

/** Select layout spacing configuration */
export const selectLayoutSpacing = (s: CanvasStoreState) => s.layoutSpacing;

/** Derived: whether any node is selected */
export const selectHasNodeSelection = (s: CanvasStoreState) => s.selectedNodeIds.length > 0;

/** Derived: whether any edge is selected */
export const selectHasEdgeSelection = (s: CanvasStoreState) => s.selectedEdgeIds.length > 0;

/** Derived: whether anything is selected */
export const selectHasSelection = (s: CanvasStoreState) =>
  s.selectedNodeIds.length > 0 || s.selectedEdgeIds.length > 0;

/** Derived: count of selected nodes */
export const selectSelectedNodeCount = (s: CanvasStoreState) => s.selectedNodeIds.length;

// ─── UI Store Selectors ───────────────────────────────────────

/** Select current theme ID */
export const selectThemeId = (s: UIStoreState) => s.themeId;

/** Select left panel open state */
export const selectLeftPanelOpen = (s: UIStoreState) => s.leftPanelOpen;

/** Select right panel open state */
export const selectRightPanelOpen = (s: UIStoreState) => s.rightPanelOpen;

/** Select right panel active tab */
export const selectRightPanelTab = (s: UIStoreState) => s.rightPanelTab;

/** Select left panel width */
export const selectLeftPanelWidth = (s: UIStoreState) => s.leftPanelWidth;

/** Select right panel width */
export const selectRightPanelWidth = (s: UIStoreState) => s.rightPanelWidth;

/** Select whether placement mode is active */
export const selectPlacementMode = (s: UIStoreState) => s.placementMode;

/** Select placement mode info */
export const selectPlacementInfo = (s: UIStoreState) => s.placementInfo;

/** Select toast message */
export const selectToastMessage = (s: UIStoreState) => s.toastMessage;

/** Select connect mode state */
export const selectConnectSource = (s: UIStoreState) => s.connectSource;
export const selectConnectTarget = (s: UIStoreState) => s.connectTarget;
export const selectConnectStep = (s: UIStoreState) => s.connectStep;

/** Derived: whether connect mode is active */
export const selectIsConnectMode = (s: UIStoreState) => s.connectStep !== null;

/** Derived: whether any modal dialog is open */
export const selectHasOpenDialog = (s: UIStoreState) =>
  s.deleteDialogOpen ||
  s.connectionDialogOpen ||
  s.unsavedChangesDialogOpen ||
  s.errorDialogOpen ||
  s.integrityWarningDialogOpen ||
  s.shortcutsHelpOpen ||
  s.commandPaletteOpen ||
  s.quickSearchOpen ||
  s.shortcutSettingsOpen ||
  s.settingsDialogOpen ||
  s.templatePickerOpen ||
  s.templateGalleryOpen;

// ─── Navigation Store Selectors ───────────────────────────────

/** Select the fractal zoom navigation path */
export const selectNavigationPath = (s: NavigationStoreState) => s.path;

/** Derived: whether we're at the root level */
export const selectIsAtRoot = (s: NavigationStoreState) => s.path.length === 0;

/** Derived: current navigation depth */
export const selectNavigationDepth = (s: NavigationStoreState) => s.path.length;

// ─── Annotation Store Selectors ───────────────────────────────

/** Select whether drawing mode is active */
export const selectIsDrawingMode = (s: AnnotationStoreState) => s.isDrawingMode;

/** Select whether eraser mode is active */
export const selectIsEraserMode = (s: AnnotationStoreState) => s.isEraserMode;

/** Select the current drawing color */
export const selectDrawingColor = (s: AnnotationStoreState) => s.color;

/** Select the current stroke width */
export const selectStrokeWidth = (s: AnnotationStoreState) => s.strokeWidth;
