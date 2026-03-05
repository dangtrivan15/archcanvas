/**
 * Button - reusable button primitive with consistent variants.
 *
 * Variants:
 * - primary: main action (blue/iris)
 * - secondary: cancel/neutral action
 * - danger: destructive action (red/love)
 * - warning: caution action (amber/gold)
 * - ghost: transparent, icon-only or toolbar button
 *
 * All variants are theme-aware and include proper focus-visible styles.
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-iris border border-transparent hover:opacity-90 focus-visible:ring-iris',
  secondary:
    'text-foreground bg-surface border border-border hover:bg-highlight-low focus-visible:ring-ring',
  danger:
    'text-white bg-love border border-transparent hover:opacity-90 focus-visible:ring-love',
  warning:
    'text-white bg-gold border border-transparent hover:opacity-90 focus-visible:ring-gold',
  ghost:
    'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent focus-visible:ring-ring',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', children, type = 'button', ...rest },
  ref,
) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none';

  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
