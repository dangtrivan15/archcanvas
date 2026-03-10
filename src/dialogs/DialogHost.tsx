/**
 * DialogHost - single component that renders all active dialogs.
 *
 * Reads `openDialogs` from the uiStore, looks up each dialog's component
 * in the registry, and renders it. This replaces inline dialog conditionals
 * in App.tsx (future migration in T2-T4).
 *
 * Currently only renders dialogs that have been migrated to the registry.
 * Legacy dialogs (rendered inline in App.tsx) continue to work unchanged.
 */

import { useUIStore } from '@/store/uiStore';
import { getDialog } from './registry';

export function DialogHost() {
  const openDialogs = useUIStore((s) => s.openDialogs);

  if (openDialogs.size === 0) return null;

  const elements: React.ReactElement[] = [];

  for (const dialogId of openDialogs) {
    const config = getDialog(dialogId);
    if (!config) {
      // Dialog not registered — skip silently (may be a legacy dialog
      // still rendered inline in App.tsx during migration)
      continue;
    }
    const Component = config.component;
    elements.push(<Component key={dialogId} />);
  }

  if (elements.length === 0) return null;

  return <>{elements}</>;
}
