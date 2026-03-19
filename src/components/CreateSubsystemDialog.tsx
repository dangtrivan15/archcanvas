import { useState, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { deriveId } from '@/lib/deriveId';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useNavigationStore } from '@/store/navigationStore';

interface CreateSubsystemDialogProps {
  open: boolean;
  type: string;
  onClose: () => void;
}

export function CreateSubsystemDialog({ open, type, onClose }: CreateSubsystemDialogProps) {
  const [name, setName] = useState('');
  const [idValue, setIdValue] = useState('');
  const [fileName, setFileName] = useState('');
  const [idOverride, setIdOverride] = useState(false);
  const [fileOverride, setFileOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefersReduced = useReducedMotion();
  const duration = prefersReduced ? 0 : undefined;

  // Auto-derive ID and filename from name (unless user has overridden)
  const derivedId = useMemo(() => deriveId(name), [name]);
  const effectiveId = idOverride ? idValue : derivedId;
  const effectiveFile = fileOverride ? fileName : `${derivedId}.yaml`;

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setError(null);
  }, []);

  const handleIdChange = useCallback((value: string) => {
    setIdValue(value);
    setIdOverride(true);
    setError(null);
  }, []);

  const handleFileChange = useCallback((value: string) => {
    setFileName(value);
    setFileOverride(true);
    setError(null);
  }, []);

  const validate = useCallback((): string | null => {
    if (!name.trim()) return 'Subsystem name is required.';
    if (!effectiveId) return 'ID cannot be empty.';
    if (!effectiveFile) return 'File name cannot be empty.';

    const project = useFileStore.getState().project;
    if (!project) return 'No project loaded.';

    // ID collision check
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const parentCanvas = useFileStore.getState().getCanvas(canvasId);
    if (parentCanvas) {
      const nodes = parentCanvas.data.nodes ?? [];
      if (nodes.some((n) => n.id === effectiveId)) {
        return `ID "${effectiveId}" already exists in this canvas. Choose a different ID.`;
      }
    }

    // Filename collision check
    const filePath = `.archcanvas/${effectiveFile}`;
    for (const canvas of project.canvases.values()) {
      if (canvas.filePath === filePath) {
        return `File "${effectiveFile}" already exists. Choose a different file name.`;
      }
    }

    return null;
  }, [name, effectiveId, effectiveFile]);

  const handleSubmit = useCallback(() => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const canvasId = useNavigationStore.getState().currentCanvasId;
    const result = useGraphStore.getState().createSubsystem(canvasId, {
      id: effectiveId,
      type,
      displayName: name.trim(),
    });

    if (!result.ok) {
      setError(`Failed: ${result.error.code}`);
      return;
    }

    // Reset and close
    setName('');
    setIdValue('');
    setFileName('');
    setIdOverride(false);
    setFileOverride(false);
    setError(null);
    onClose();
  }, [validate, effectiveId, type, name, onClose]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setName('');
      setIdValue('');
      setFileName('');
      setIdOverride(false);
      setFileOverride(false);
      setError(null);
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40"
                initial={prefersReduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0 }}
                transition={{ duration: duration ?? 0.15, ease: 'easeOut' }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              forceMount
              asChild
              data-testid="create-subsystem-dialog"
            >
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover p-6 shadow-2xl"
                initial={prefersReduced ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0, scale: 0.95 }}
                transition={{ duration: duration ?? 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <Dialog.Title className="text-lg font-semibold text-popover-foreground">
                  Create Subsystem
                </Dialog.Title>
                <VisuallyHidden.Root asChild>
                  <Dialog.Description>Create a new subsystem canvas</Dialog.Description>
                </VisuallyHidden.Root>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-popover-foreground mb-1">
                      Subsystem name
                    </label>
                    <input
                      data-testid="subsystem-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g., Order Service"
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-popover-foreground mb-1">
                      ID
                    </label>
                    <input
                      data-testid="subsystem-id-input"
                      type="text"
                      value={effectiveId}
                      onChange={(e) => handleIdChange(e.target.value)}
                      placeholder="auto-derived from name"
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-popover-foreground mb-1">
                      File name
                    </label>
                    <input
                      data-testid="subsystem-filename-input"
                      type="text"
                      value={effectiveFile}
                      onChange={(e) => handleFileChange(e.target.value)}
                      placeholder="auto-derived from name"
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        key="error"
                        data-testid="subsystem-error"
                        className="text-sm text-destructive-foreground"
                        initial={prefersReduced ? false : { opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    className="rounded px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </button>
                  <motion.button
                    data-testid="subsystem-create-btn"
                    className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                    onClick={handleSubmit}
                    whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  >
                    Create
                  </motion.button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
