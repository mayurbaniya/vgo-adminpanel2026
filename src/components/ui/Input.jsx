import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef(function Input(
  { className, leftIcon, rightSlot, ...props },
  ref,
) {
  return (
    <div className="relative">
      {leftIcon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          {leftIcon}
        </div>
      )}
      <input
        ref={ref}
        className={cn(
          'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          'disabled:cursor-not-allowed disabled:bg-slate-50',
          leftIcon && 'pl-10',
          rightSlot && 'pr-10',
          className,
        )}
        {...props}
      />
      {rightSlot && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {rightSlot}
        </div>
      )}
    </div>
  );
});

export function Label({ children, htmlFor, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('mb-1.5 block text-xs font-semibold text-slate-700', className)}
    >
      {children}
    </label>
  );
}
