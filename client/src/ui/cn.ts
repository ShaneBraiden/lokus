import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge needs the custom token names so colour and size utilities never get mixed up. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'canvas', 'surface', 'subtle', 'line', 'line-strong', 'ink', 'ink-2', 'muted', 'faint', 'copper', 'accent', 'accent-hover',
        'accent-soft', 'accent-line', 'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'info',
        'info-soft', 'violet', 'violet-soft', 'paper', 'paper-line',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
