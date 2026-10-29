import * as RDM from '@radix-ui/react-dropdown-menu';
import * as RP from '@radix-ui/react-popover';
import * as RT from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from './cn';

// Re-exported (not `const X = NS.Root`) so unused primitives tree-shake out of the entry chunk.
export { Root as DropdownMenu, Trigger as DropdownTrigger } from '@radix-ui/react-dropdown-menu';
export { Root as Popover, Trigger as PopoverTrigger, Anchor as PopoverAnchor, Close as PopoverClose } from '@radix-ui/react-popover';
export { Root as Tabs, Content as TabsContent } from '@radix-ui/react-tabs';

export function DropdownContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <RDM.Portal>
      <RDM.Content align={align} sideOffset={6} className={cn('z-50 min-w-48 animate-fade-in rounded-lg border border-line bg-surface p-1 shadow-pop', className)}>
        {children}
      </RDM.Content>
    </RDM.Portal>
  );
}

export function DropdownItem({ children, onSelect, tone, disabled }: { children: ReactNode; onSelect?: () => void; tone?: 'danger'; disabled?: boolean }) {
  return (
    <RDM.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-subtle data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted',
        tone === 'danger' && 'text-danger [&_svg]:text-danger',
      )}
    >
      {children}
    </RDM.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <RDM.Label className="px-2.5 py-1.5 text-xs font-medium text-muted">{children}</RDM.Label>;
}

export const DropdownSeparator = () => <RDM.Separator className="my-1 h-px bg-line" />;

export function PopoverContent({ children, className, align = 'start', side = 'bottom' }: { children: ReactNode; className?: string; align?: 'start' | 'center' | 'end'; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RP.Portal>
      <RP.Content align={align} side={side} sideOffset={6} collisionPadding={12} className={cn('z-50 animate-fade-in rounded-lg border border-line bg-surface shadow-pop focus:outline-none', className)}>
        {children}
      </RP.Content>
    </RP.Portal>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <RT.List className={cn('flex gap-1 border-b border-line', className)}>{children}</RT.List>;
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RT.Trigger
      value={value}
      className="-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink [&_svg]:size-4"
    >
      {children}
    </RT.Trigger>
  );
}
