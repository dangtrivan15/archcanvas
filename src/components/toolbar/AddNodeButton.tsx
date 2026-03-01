/**
 * Add Node button - opens the NodeDef browser panel for adding new nodes.
 */

import { Plus } from 'lucide-react';

export function AddNodeButton() {
  const handleClick = () => {
    // Toggle NodeDef browser panel - will be wired when panel features are implemented
    console.log('[AddNodeButton] Toggle NodeDef browser panel');
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-[hsl(var(--muted))] transition-colors"
      data-testid="add-node-button"
      title="Add Node"
    >
      <Plus className="w-4 h-4" />
      <span>Add Node</span>
    </button>
  );
}
