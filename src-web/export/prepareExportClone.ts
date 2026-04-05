/**
 * Prepare a pre-processed DOM clone for export.
 *
 * This is the orchestrator that combines all export pre-processing steps:
 *
 * 1. Clone the viewport DOM
 * 2. Filter out ghost/temporary elements
 * 3. Inline all computed styles (resolves CSS vars, color-mix, @layer, etc.)
 * 4. Materialize pseudo-elements as real DOM nodes
 * 5. Embed fonts as base64
 * 6. Wrap in an offscreen container for html-to-image
 *
 * The result is a self-contained DOM subtree that html-to-image can render
 * correctly without needing access to stylesheets, CSS variables, or fonts.
 */

import { inlineStyles } from './inlineStyles';
import { materializePseudos } from './materializePseudos';
import { embedFonts } from './embedFonts';
import { filterGhostElements } from './domUtils';

export interface ExportClone {
  /** The wrapper element appended to document.body */
  wrapper: HTMLElement;
  /** The cloned viewport element inside the wrapper (pass this to html-to-image) */
  viewport: HTMLElement;
  /** Clean up: remove the wrapper from the DOM */
  cleanup: () => void;
}

/**
 * Prepare a fully pre-processed clone of the ReactFlow viewport for export.
 *
 * The returned `viewport` element has all styles inlined, pseudo-elements
 * materialized, and fonts embedded. Pass it to `toPng()` or `toSvg()`.
 *
 * **Important:** Always call `cleanup()` when done (use a `finally` block).
 */
export async function prepareExportClone(
  originalViewport: HTMLElement,
): Promise<ExportClone> {
  // 1. Deep clone
  const clone = originalViewport.cloneNode(true) as HTMLElement;

  // 2. Filter ghost elements from the clone
  removeFilteredElements(clone);

  // 3. Inline all computed styles from the live DOM onto the clone
  //    This resolves CSS variables, color-mix(), @layer/@theme, etc.
  inlineStyles(originalViewport, clone);

  // 4. Materialize pseudo-elements (cylinder caps, document wave, etc.)
  materializePseudos(originalViewport, clone);

  // 5. Create an offscreen wrapper to hold the clone
  //    This needs to be in the document so html-to-image can measure it,
  //    but positioned offscreen so it's not visible.
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '-99999px';
  wrapper.style.width = `${originalViewport.scrollWidth}px`;
  wrapper.style.height = `${originalViewport.scrollHeight}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.pointerEvents = 'none';

  // 6. Embed fonts as base64 @font-face rules
  await embedFonts(wrapper);

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return {
    wrapper,
    viewport: clone,
    cleanup: () => {
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    },
  };
}

/**
 * Recursively remove elements that should be filtered from the export.
 * This handles the same filtering as `filterGhostElements` but on a cloned tree.
 */
function removeFilteredElements(root: HTMLElement): void {
  // Collect elements to remove first, then remove them
  // (modifying the DOM while iterating is unsafe)
  const toRemove: Element[] = [];
  const allElements = root.querySelectorAll('*');

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i] as HTMLElement;
    if (!filterGhostElements(el)) {
      toRemove.push(el);
    }
  }

  for (const el of toRemove) {
    el.parentNode?.removeChild(el);
  }
}
