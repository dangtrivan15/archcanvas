/**
 * Animated copy-to-clipboard button with icon morph feedback.
 * Adapted from animate-ui's CopyButton — simplified to remove
 * ButtonPrimitive and CVA dependencies.
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckIcon, CopyIcon } from 'lucide-react';

interface CopyButtonProps extends React.ComponentProps<'button'> {
  content: string;
  /** How long to show the "copied" state (ms) */
  delay?: number;
  /** Icon size */
  iconSize?: number;
}

export function CopyButton({
  content,
  delay = 1500,
  iconSize = 12,
  className,
  onClick,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const prefersReduced = useReducedMotion();

  const handleCopy = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (copied) return;
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), delay);
      });
    },
    [onClick, copied, content, delay],
  );

  const Icon = copied ? CheckIcon : CopyIcon;

  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy'}
      className={className}
      onClick={handleCopy}
      {...props}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={copied ? 'check' : 'copy'}
          className="inline-flex"
          initial={prefersReduced ? false : { scale: 0, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={prefersReduced ? undefined : { scale: 0, opacity: 0.4 }}
          transition={{ duration: 0.2 }}
        >
          <Icon
            size={iconSize}
            className={copied ? 'text-green-500' : undefined}
          />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
