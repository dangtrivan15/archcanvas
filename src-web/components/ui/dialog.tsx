import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const DialogContext = React.createContext({ open: false })

function Dialog({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: DialogPrimitive.DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const open = controlledOpen ?? internalOpen

  return (
    <DialogContext.Provider value={{ open }}>
      <DialogPrimitive.Root
        data-slot="dialog"
        open={open}
        onOpenChange={(value) => {
          setInternalOpen(value)
          onOpenChange?.(value)
        }}
        {...props}
      />
    </DialogContext.Provider>
  )
}

function DialogTrigger({
  ...props
}: DialogPrimitive.DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.DialogPortalProps) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.DialogContentProps) {
  const { open } = React.useContext(DialogContext)
  const prefersReduced = useReducedMotion()
  const duration = prefersReduced ? 0 : undefined

  return (
    <AnimatePresence>
      {open && (
        <DialogPortal forceMount>
          <DialogPrimitive.Overlay forceMount asChild>
            <motion.div
              data-slot="dialog-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration ?? 0.15, ease: "easeOut" }}
              className="fixed inset-0 z-50 bg-black/50"
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content
            data-slot="dialog-content"
            forceMount
            asChild
            {...props}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: duration ?? 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[28rem] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-card p-6 shadow-lg",
                className
              )}
            >
              {children}
              <DialogPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-card transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPortal>
      )}
    </AnimatePresence>
  )
}

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: DialogPrimitive.DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold leading-none text-card-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
