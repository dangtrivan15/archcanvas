import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ArchTemplate } from '@/core/templates/schema';
import { TemplateGrid } from './TemplateGrid';

interface TemplatePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: ArchTemplate) => void;
}

export function TemplatePickerDialog({ open, onClose, onSelect }: TemplatePickerDialogProps) {
  const [selected, setSelected] = useState<ArchTemplate | null>(null);

  function handleCreate() {
    if (selected) {
      onSelect(selected);
      setSelected(null);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSelected(null);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New from Template</DialogTitle>
          <DialogDescription>
            Create a new project from an architecture template
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto">
          <TemplateGrid
            onSelect={setSelected}
            selectedId={selected?.id}
            compact
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Project
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
