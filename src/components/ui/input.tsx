import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
  error?: string;
  suffix?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, description, error, suffix, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-copy" htmlFor={inputId}>
        {label}
      </label>
      {description ? (
        <p
          className="text-xs leading-[18px] text-copy-muted"
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      <div className="relative">
        <input
          aria-describedby={errorId ?? descriptionId}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-10 w-full rounded-[var(--radius-sm)] border bg-panel px-3 text-sm text-copy placeholder:text-copy-disabled disabled:cursor-not-allowed disabled:bg-panel-muted disabled:text-copy-disabled',
            error ? 'border-danger' : 'border-line hover:border-copy-disabled',
            suffix != null && 'pr-10',
            className,
          )}
          id={inputId}
          ref={ref}
          {...props}
        />
        {suffix ? (
          <span className="absolute inset-y-0 right-3 flex items-center text-copy-muted">
            {suffix}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs leading-[18px] text-danger" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
});
