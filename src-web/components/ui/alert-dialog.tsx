/**
 * Alert Dialog with motion enter/exit animations.
 * Built on @radix-ui/react-alert-dialog, following the same pattern
 * as the existing dialog.tsx in this project.
 */

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';

const AlertDialogContext = React.createContext({ open: false });

function AlertDialog({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: AlertDialogPrimitive.AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const open = controlledOpen ?? internalOpen;

  return (
    <AlertDialogContext.Provider value={{ open }}>
      <AlertDialogPrimitive.Root
        open={open}
        onOpenChange={(value) => {
          setInternalOpen(value);
          onOpenChange?.(value);
        }}
        {...props}
      />
    </AlertDialogContext.Provider>
  );
}

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

function AlertDialogContent({
  className,
  children,
  ...props
}: AlertDialogPrimitive.AlertDialogContentProps) {
  const { open } = React.useContext(AlertDialogContext);
  const prefersReduced = useReducedMotion();
  const duration = prefersReduced ? 0 : undefined;

  return (
    <AnimatePresence>
      {open && (
        <AlertDialogPrimitive.Portal forceMount>
          <AlertDialogPrimitive.Overlay forceMount asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration ?? 0.15, ease: 'easeOut' }}
              className="fixed inset-0 z-50 bg-black/50"
            />
          </AlertDialogPrimitive.Overlay>
          <AlertDialogPrimitive.Content forceMount asChild {...props}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: duration ?? 0.15, ease: 'easeOut' }}
              className={cn(
                'fixed top-1/2 left-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-background p-6 shadow-lg',
                className,
              )}
            >
              {children}
            </motion.div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.AlertDialogTitleProps) {
  return <AlertDialogPrimitive.Title className={cn('text-sm font-semibold text-card-foreground', className)} {...props} />;
}

function AlertDialogDescription({ className, ...props }: AlertDialogPrimitive.AlertDialogDescriptionProps) {
  return <AlertDialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function AlertDialogAction({ className, ...props }: AlertDialogPrimitive.AlertDialogActionProps) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogCancel({ className, ...props }: AlertDialogPrimitive.AlertDialogCancelProps) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
