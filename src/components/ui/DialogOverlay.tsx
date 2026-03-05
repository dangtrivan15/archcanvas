/**
 * DialogOverlay - reusable modal overlay + content container.
 *
 * Provides consistent:
 * - Backdrop with click-to-dismiss
 * - Theme-aware content panel (bg-surface, text-foreground)
 * - Proper ARIA attributes (role, aria-modal, aria-labelledby)
 * - Compact viewport adaptation (bottom sheet on narrow screens)
 * - Focus trap integration slot
 */

import { useCallback, type ReactNode, type MouseEvent } from 'react';

export interface DialogOverlayProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close (backdrop click or programmatic) */
  onClose: () => void;
  /** Content rendered inside the dialog panel */
  children: ReactNode;
  /** data-testid for the overlay */
  testId?: string;
  /** ARIA role - defaults to 'dialog', use 'alertdialog' for errors */
  role?: 'dialog' | 'alertdialog';
  /** ID of the element labelling this dialog */
  ariaLabelledBy?: string;
  /** ID of the element describing this dialog */
  ariaDescribedBy?: string;
  /** Max width class (default: 'max-w-md') */
  maxWidth?: string;
  /** Ref forwarded to the content panel (for focus trap) */
  contentRef?: React.Ref<HTMLDivElement>;
}

export function DialogOverlay({
  open,
  onClose,
  children,
  testId,
  role = 'dialog',
  ariaLabelledBy,
  ariaDescribedBy,
  maxWidth = 'max-w-md',
  contentRef,
}: DialogOverlayProps) {
  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 compact-dialog-overlay"
      onClick={handleBackdropClick}
      data-testid={testId}
      role={role}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      <div
        ref={contentRef}
        className={`bg-surface text-foreground rounded-lg shadow-xl ${maxWidth} w-full mx-4 p-6 compact-dialog-sheet`}
        data-testid={testId ? `${testId}-content` : undefined}
      >
        {children}
      </div>
    </div>
  );
}
