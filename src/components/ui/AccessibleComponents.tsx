import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

// Accessible Button with proper ARIA support
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ children, isLoading, loadingText, leftIcon, rightIcon, disabled, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'focus-visible:ring-indigo-500 focus-visible:ring-offset-background',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-all duration-200',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="sr-only">{loadingText || 'Loading...'}</span>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span aria-live="polite">{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);
AccessibleButton.displayName = 'AccessibleButton';

// Accessible Input with label and error handling
interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  hideLabel?: boolean;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, error, hint, hideLabel, className, id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-zinc-900 dark:text-zinc-100',
            hideLabel && 'sr-only'
          )}
        >
          {label}
          {props.required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        
        <input
          ref={ref}
          id={id}
          aria-describedby={cn(error && errorId, hint && hintId) || undefined}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'w-full px-3 py-2 rounded-lg border',
            'bg-white dark:bg-zinc-900',
            'text-zinc-900 dark:text-zinc-100',
            'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            'transition-all duration-200',
            error
              ? 'border-red-500 focus-visible:ring-red-500'
              : 'border-zinc-200 dark:border-zinc-700',
            className
          )}
          {...props}
        />
        
        {hint && !error && (
          <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
            {hint}
          </p>
        )}
        
        {error && (
          <p id={errorId} className="text-xs text-red-500 flex items-center gap-1" role="alert">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);
AccessibleInput.displayName = 'AccessibleInput';

// Skip to main content link
export function SkipToContent({ mainId = 'main-content' }: { mainId?: string }) {
  return (
    <a
      href={`#${mainId}`}
      className={cn(
        'sr-only focus:not-sr-only',
        'focus:fixed focus:top-4 focus:left-4 focus:z-[9999]',
        'focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2'
      )}
    >
      Skip to main content
    </a>
  );
}

// Screen reader only text
export function SROnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

// Live region for announcements
interface LiveRegionProps {
  message: string;
  type?: 'polite' | 'assertive';
}

export function LiveRegion({ message, type = 'polite' }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

// Focus trap component
interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
}

export function FocusTrap({ children, active = true }: FocusTrapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [active]);

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}

// Progress indicator with accessibility
interface ProgressIndicatorProps {
  value: number;
  max?: number;
  label: string;
  showValue?: boolean;
}

export function ProgressIndicator({ 
  value, 
  max = 100, 
  label, 
  showValue = true 
}: ProgressIndicatorProps) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        {showValue && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{percentage}%</span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-indigo-500 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
