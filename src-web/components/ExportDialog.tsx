import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Download, FileCode, FileText, Check } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { exportAndSave, ExportError } from '@/export';
import type { ExportFormat } from '@/export';

const FORMAT_OPTIONS: Array<{ value: ExportFormat; icon: typeof FileCode; label: string; description: string }> = [
  { value: 'svg', icon: FileCode, label: 'SVG', description: 'Vector image' },
  { value: 'markdown', icon: FileText, label: 'Markdown', description: 'Text + Mermaid' },
];

export function ExportDialog() {
  const open = useUiStore((s) => s.showExportDialog);
  const close = useUiStore((s) => s.closeExportDialog);

  const [format, setFormat] = useState<ExportFormat>('svg');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefersReduced = useReducedMotion();

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const saved = await exportAndSave({ format });
      if (saved) {
        close();
      }
    } catch (err) {
      if (err instanceof ExportError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during export.');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { close(); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Canvas</DialogTitle>
          <DialogDescription>
            Choose a format and save your architecture diagram.
          </DialogDescription>
        </DialogHeader>

        {/* Format picker */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">Format</p>
          <div className="grid grid-cols-2 gap-2">
            {FORMAT_OPTIONS.map(({ value, icon: Icon, label, description }) => (
              <button
                key={value}
                aria-pressed={format === value}
                onClick={() => { setFormat(value); setError(null); }}
                className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors hover:bg-accent/50 ${
                  format === value
                    ? 'border-primary bg-accent/30'
                    : 'border-border'
                }`}
              >
                <AnimatePresence>
                  {format === value && (
                    <motion.div
                      key="check"
                      initial={prefersReduced ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={prefersReduced ? undefined : { scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-2 right-2"
                    >
                      <Check className="size-3.5 text-primary" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <Icon className="size-5 text-muted-foreground" />
                <span className="font-medium text-card-foreground">{label}</span>
                <span className="text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {/* Export button */}
        <DialogFooter>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="size-4" />
            {exporting ? 'Exporting\u2026' : 'Export'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
