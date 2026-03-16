import { create } from 'zustand';
import { useFileStore } from './fileStore';
import { useHistoryStore } from './historyStore';
import { useCanvasStore } from './canvasStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import type { Edge } from '@/types';

interface BreadcrumbEntry {
  canvasId: string;
  displayName: string;
}

interface NavigationStoreState {
  currentCanvasId: string;
  breadcrumb: BreadcrumbEntry[];
  parentCanvasId: string | null;
  parentEdges: Edge[];

  diveIn(refNodeId: string): void;
  goUp(): void;
  goToRoot(): void;
  goToBreadcrumb(index: number): void;
  navigateTo(canvasId: string): void;
}

const ROOT_ENTRY: BreadcrumbEntry = {
  canvasId: ROOT_CANVAS_KEY,
  displayName: 'Root',
};

export const useNavigationStore = create<NavigationStoreState>((set, get) => ({
  currentCanvasId: ROOT_CANVAS_KEY,
  breadcrumb: [ROOT_ENTRY],
  parentCanvasId: null,
  parentEdges: [],

  diveIn(refNodeId) {
    const { currentCanvasId } = get();
    const fileStore = useFileStore.getState();
    const canvas = fileStore.getCanvas(currentCanvasId);
    if (!canvas) return;

    // Find the node with the given id
    const node = (canvas.data.nodes ?? []).find((n) => n.id === refNodeId);
    if (!node || !('ref' in node) || !node.ref) return;

    // Canvas map is keyed by node.id (the ref-node identity), not the ref filename
    const targetCanvasId = refNodeId;

    // Verify the target canvas exists
    const targetCanvas = fileStore.getCanvas(targetCanvasId);
    if (!targetCanvas) return;

    const displayName = targetCanvas.data.displayName ?? refNodeId;

    useHistoryStore.getState().clear();
    useCanvasStore.getState().clearHighlight();
    set((state) => ({
      currentCanvasId: targetCanvasId,
      breadcrumb: [
        ...state.breadcrumb,
        { canvasId: targetCanvasId, displayName },
      ],
      parentCanvasId: currentCanvasId,
      parentEdges: canvas.data.edges ?? [],
    }));
  },

  goUp() {
    const { breadcrumb } = get();
    if (breadcrumb.length <= 1) return; // already at root, no-op

    const newBreadcrumb = breadcrumb.slice(0, -1);
    const target = newBreadcrumb[newBreadcrumb.length - 1];
    useHistoryStore.getState().clear();
    useCanvasStore.getState().clearHighlight();

    // Restore parent context if still nested (depth >= 2)
    if (newBreadcrumb.length >= 2) {
      const parentEntry = newBreadcrumb[newBreadcrumb.length - 2];
      const parentCanvas = useFileStore.getState().getCanvas(parentEntry.canvasId);
      set({
        breadcrumb: newBreadcrumb,
        currentCanvasId: target.canvasId,
        parentCanvasId: parentEntry.canvasId,
        parentEdges: parentCanvas?.data.edges ?? [],
      });
    } else {
      set({ breadcrumb: newBreadcrumb, currentCanvasId: target.canvasId, parentCanvasId: null, parentEdges: [] });
    }
  },

  goToRoot() {
    useHistoryStore.getState().clear();
    useCanvasStore.getState().clearHighlight();
    set({ currentCanvasId: ROOT_CANVAS_KEY, breadcrumb: [ROOT_ENTRY], parentCanvasId: null, parentEdges: [] });
  },

  goToBreadcrumb(index) {
    const { breadcrumb } = get();
    if (index < 0 || index >= breadcrumb.length) return;

    const newBreadcrumb = breadcrumb.slice(0, index + 1);
    const target = newBreadcrumb[index];
    useHistoryStore.getState().clear();
    useCanvasStore.getState().clearHighlight();

    // Restore parent context if target is nested (index >= 1)
    if (index >= 1) {
      const parentEntry = newBreadcrumb[index - 1];
      const parentCanvas = useFileStore.getState().getCanvas(parentEntry.canvasId);
      set({
        breadcrumb: newBreadcrumb,
        currentCanvasId: target.canvasId,
        parentCanvasId: parentEntry.canvasId,
        parentEdges: parentCanvas?.data.edges ?? [],
      });
    } else {
      set({ breadcrumb: newBreadcrumb, currentCanvasId: target.canvasId, parentCanvasId: null, parentEdges: [] });
    }
  },

  navigateTo(canvasId) {
    useHistoryStore.getState().clear();
    useCanvasStore.getState().clearHighlight();
    if (canvasId === ROOT_CANVAS_KEY) {
      set({ currentCanvasId: ROOT_CANVAS_KEY, breadcrumb: [ROOT_ENTRY], parentCanvasId: null, parentEdges: [] });
      return;
    }

    const fileStore = useFileStore.getState();
    const targetCanvas = fileStore.getCanvas(canvasId);
    const displayName = targetCanvas?.data.displayName ?? canvasId;

    // Simplified breadcrumb: root + target (full path resolution not available yet)
    set({
      currentCanvasId: canvasId,
      breadcrumb: [
        ROOT_ENTRY,
        { canvasId, displayName },
      ],
      parentCanvasId: null,
      parentEdges: [],
    });
  },
}));
