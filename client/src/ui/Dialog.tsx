import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/** Without a description, opt out explicitly (Radix's documented way) instead of repeating the title to screen readers. */
const noDescription = (description: ReactNode) => (description ? {} : { 'aria-describedby': undefined });

/** Centred modal dialog (Radix): focus is trapped and restored, Escape closes. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizes;
  dismissible?: boolean;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/40 backdrop-blur-[2px]" />
        <RD.Content
          {...noDescription(description)}
          onInteractOutside={(e) => !dismissible && e.preventDefault()}
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-scale-in flex-col rounded-xl border border-line bg-surface shadow-pop focus:outline-none',
            sizes[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <RD.Title className="text-base font-semibold text-ink">{title}</RD.Title>
              {description && <RD.Description className="mt-1 text-[13px] text-muted">{description}</RD.Description>}
            </div>
            {dismissible && (
              <RD.Close className="-mr-1 rounded-md p-1 text-muted hover:bg-subtle hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </RD.Close>
            )}
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

/** Right-hand panel for longer forms and documents. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 'max-w-xl',
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
  bodyClassName?: string;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/30" />
        <RD.Content {...noDescription(description)} className={cn('fixed inset-y-0 right-0 z-50 flex w-full animate-slide-in flex-col border-l border-line bg-surface shadow-pop focus:outline-none', width)}>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <RD.Title className="text-base font-semibold text-ink">{title}</RD.Title>
              {description && <RD.Description className="mt-1 text-[13px] text-muted">{description}</RD.Description>}
            </div>
            <RD.Close className="-mr-1 rounded-md p-1 text-muted hover:bg-subtle hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </RD.Close>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
