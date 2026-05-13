import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

// `dismissible={false}` blocks Escape, backdrop click, and the X button.
// Use it while a form inside is mid-submit so the user can't close
// half-way through a request.
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissible = true,
}) {
  useEffect(() => {
    if (!open || !dismissible) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        className={cn(
          // max-h + flex column so the body scrolls and header/footer stay
          // sticky — protects against tall content (multi-image previews,
          // long forms) pushing the action buttons off-screen.
          'relative flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-xl',
          sizes[size],
        )}
      >
        <div className="flex flex-shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
