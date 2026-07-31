import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent text-copy hover:border-accent-hover hover:bg-accent-hover hover:text-white active:border-accent-strong active:bg-accent-strong active:text-white',
  secondary:
    'border-line bg-panel text-copy-secondary hover:border-copy-disabled hover:bg-panel-muted',
  tertiary:
    'border-transparent bg-transparent text-copy-secondary hover:bg-panel-muted',
  danger: 'border-danger bg-danger text-white hover:opacity-90',
};

const sizeStyles: Record<ButtonSize, string> = {
  small: 'h-8 px-3 text-xs',
  medium: 'h-10 px-4 text-sm',
  large: 'h-12 px-5 text-base',
};

export function buttonClassName({
  variant = 'primary',
  size = 'medium',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45',
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      ) : null}
      <span>{loading ? '처리 중' : children}</span>
    </button>
  );
}
