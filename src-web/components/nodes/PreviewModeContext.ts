import { createContext } from 'react';

/**
 * When true, NodeRenderer is being rendered inside a preview context.
 * Used to prevent recursive ReactFlow instances in nested canvas views.
 */
export const PreviewModeContext = createContext(false);
