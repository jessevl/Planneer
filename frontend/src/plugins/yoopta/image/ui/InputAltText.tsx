/**
 * @file InputAltText.tsx
 * @description Alt text input modal
 * Custom styling for Planneer with dark mode support
 */
import type { CSSProperties } from 'react';
import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
import { cn } from '@/lib/design-system';

const { Overlay, Portal } = UI;

type Props = {
  floatingStyles: CSSProperties;
  onClose: () => void;
  refs: {
    setFloating: (node: HTMLElement | null) => void;
  };
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
};

export const InputAltText = ({ 
  floatingStyles, 
  onClose, 
  refs, 
  value, 
  onChange, 
  onSave, 
  onDelete 
}: Props) => (
  <Portal id="yoo-image-alt-portal">
    <Overlay lockScroll className="z-[100]" onClick={onClose}>
      <div 
        ref={refs.setFloating} 
        style={floatingStyles} 
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            'p-4 rounded-lg min-w-[280px]',
            'bg-[var(--color-surface-base)]',
            'border border-[var(--color-border-primary)]',
            'shadow-lg'
          )}
        >
          <div className="space-y-3">
            <label 
              htmlFor="alt" 
              className="block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Alternative text
            </label>
            <input
              id="alt"
              type="text"
              name="alt"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Describe this image..."
              autoComplete="off"
              className={cn(
                'w-full h-9 px-3 text-sm rounded-lg',
                'bg-[var(--color-surface-secondary)]',
                'text-[var(--color-text-primary)]',
                'border border-[var(--color-border-primary)]',
                'placeholder:text-[var(--color-text-tertiary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30'
              )}
            />
          </div>
          <div className="mt-4 flex justify-between gap-2">
            <button
              type="button"
              disabled={!value}
              onClick={onSave}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md',
                'bg-[var(--color-accent-primary)] text-white',
                'hover:bg-[var(--color-accent-emphasis)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              Update
            </button>
            <button
              type="button"
              onClick={onDelete}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md',
                'bg-[var(--color-surface-secondary)]',
                'text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-surface-tertiary)]',
                'transition-colors'
              )}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  </Portal>
);
