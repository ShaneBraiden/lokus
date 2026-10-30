import * as RT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

/** Hover and keyboard-focus tooltip. It only ever repeats information that is also visible or in a table. */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <RT.Provider delayDuration={120} skipDelayDuration={60}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content side={side} sideOffset={6} collisionPadding={8} className="z-[70] max-w-xs animate-fade-in rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink shadow-pop">
            {content}
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}
