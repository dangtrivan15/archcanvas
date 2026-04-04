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
 * For desktop (Tauri), creates a new window with the template query param.
 * The new window's ProjectGate handles directory selection and template application.
 * For web, applies the template to the current project in-place.
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
    // Web: apply template to the current project in-place
    const fs = useFileStore.getState().fs;
    if (!fs) {
      console.error('[templates] Cannot apply template: no filesystem available');
      return;
    }

    try {
      const { applyTemplate } = await import('@/core/templates/apply');
      await applyTemplate(fs, template);
      await useFileStore.getState().loadProject(fs);
    } catch (err) {
      console.error('[templates] Failed to apply template:', err);
      useFileStore.setState({
        status: 'error',
        error: `Failed to apply template: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
