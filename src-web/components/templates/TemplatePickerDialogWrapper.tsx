import { useUiStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import type { ArchTemplate } from '@/core/templates/schema';

/**
 * Connects the TemplatePickerDialog to the global UI store.
 * When a template is selected, opens a new project in a new window/tab.
 */
export function TemplatePickerDialogWrapper() {
  const open = useUiStore((s) => s.showTemplatePickerDialog);
  const close = useUiStore((s) => s.closeTemplatePickerDialog);

  async function handleSelect(template: ArchTemplate) {
    await newFromTemplate(template);
    close();
  }

  return (
    <TemplatePickerDialog
      open={open}
      onClose={close}
      onSelect={handleSelect}
    />
  );
}

/**
 * Opens a new project from a template in a new window/tab.
 * For desktop (Tauri), creates a new window with query params.
 * For web, opens a new browser tab.
 */
async function newFromTemplate(template: ArchTemplate) {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  if (isTauri) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      new WebviewWindow(`project-${Date.now()}`, {
        url: `/?template=${encodeURIComponent(template.id)}`,
        title: 'ArchCanvas',
        width: 1280,
        height: 800,
      });
    } catch (err) {
      console.error('[templates] Failed to create Tauri window:', err);
    }
  } else {
    // Web: If no project loaded yet, apply template in-place
    const fs = useFileStore.getState().fs;
    if (!fs) return;

    const { applyTemplate } = await import('@/core/templates/apply');
    await applyTemplate(fs, template);
    await useFileStore.getState().loadProject(fs);
  }
}
