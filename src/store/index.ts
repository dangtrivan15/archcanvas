/**
 * Zustand stores barrel export.
 */

export { useCoreStore } from './coreStore';
export type { CoreStoreState } from './coreStore';

export { useUIStore, computeDefaultLeftPanelWidth, computeDefaultRightPanelWidth } from './uiStore';
export type { UIStoreState, DeleteDialogInfo, ConnectionDialogInfo, PlacementModeInfo, ConnectModeState, UnsavedChangesDialogInfo, ErrorDialogInfo, IntegrityWarningDialogInfo } from './uiStore';
export type { ConnectModeStep } from './uiStore';
export {
  THEME_STORAGE_KEY,
  HAPTIC_FEEDBACK_STORAGE_KEY,
  LEFT_PANEL_MIN_WIDTH,
  LEFT_PANEL_MAX_WIDTH,
  LEFT_PANEL_VIEWPORT_RATIO,
  LEFT_PANEL_DEFAULT_FLOOR,
  LEFT_PANEL_DEFAULT_CEILING,
  LEFT_PANEL_DEFAULT_WIDTH,
  LEFT_PANEL_COLLAPSE_THRESHOLD,
  RIGHT_PANEL_VIEWPORT_RATIO,
  RIGHT_PANEL_DEFAULT_FLOOR,
  RIGHT_PANEL_DEFAULT_CEILING,
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
} from './uiStore';

export { useCanvasStore } from './canvasStore';
export type { CanvasStoreState, LayoutSpacing } from './canvasStore';
export { DEFAULT_LAYOUT_SPACING, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_DURATION } from './canvasStore';

export { useNavigationStore } from './navigationStore';
export type { NavigationStoreState } from './navigationStore';


export { usePencilStore } from './pencilStore';
export type { PencilStoreState, PencilTilt } from './pencilStore';

export { useAnnotationStore, ANNOTATION_COLORS } from './annotationStore';
export type { AnnotationStoreState } from './annotationStore';

export { useProjectStore } from './projectStore';
export type { ProjectStoreState, LoadedFileEntry } from './projectStore';

export { useNestedCanvasStore } from './nestedCanvasStore';
export type { NestedCanvasStoreState, FileStackEntry, ParentEdgeIndicator } from './nestedCanvasStore';

// Centralized selectors for granular subscriptions
export * from './selectors';
