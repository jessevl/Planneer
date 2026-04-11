/**
 * @file Resizer.tsx
 * @description Resize handles for image resizing
 * Custom styling for Planneer with dark mode support
 */
import { cn } from '@/lib/design-system';

type Props = {
  position: 'left' | 'right';
};

export const Resizer = ({ position }: Props) => (
  <div
    contentEditable={false}
    className={cn(
      'absolute pointer-events-none flex items-center justify-center z-10',
      'h-full w-4 cursor-col-resize transition-opacity duration-150 ease-in',
      position === 'left' ? 'left-0 top-0' : 'right-0 top-0'
    )}
  >
    <div
      className={cn(
        'rounded-full w-1.5 h-12 max-h-[50%]',
        'bg-[var(--color-surface-overlay)]',
        'border border-[var(--color-surface-base)]',
        'shadow-sm',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
      )}
    />
  </div>
);
