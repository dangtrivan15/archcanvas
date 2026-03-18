import { createContext } from 'react';

/**
 * When true, NodeRenderer skips rendering SubsystemPreview inside RefNodes.
 * Used by the mini ReactFlow preview to prevent recursive ReactFlow instances.
 */
export const PreviewModeContext = createContext(false);
