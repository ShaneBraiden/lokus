import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from './cn';

/** Plain, consistent data tables: hairline rows, muted headers, tabular figures in numeric cells. */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-line bg-subtle/60', className)} {...props} />;
}

export function TH({ className, numeric, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th scope="col" className={cn('whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-muted', numeric && 'text-right', className)} {...props} />;
}

export function TR({ className, interactive, ...props }: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return <tr className={cn('border-b border-line last:border-b-0', interactive && 'cursor-pointer transition-colors hover:bg-subtle/70', className)} {...props} />;
}

export function TD({ className, numeric, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn('px-4 py-3 align-top text-ink-2', numeric && 'text-right tabular', className)} {...props} />;
}
