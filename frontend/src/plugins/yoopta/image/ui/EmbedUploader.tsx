/**
 * @file EmbedUploader.tsx
 * @description URL-based image embed component
 * Custom styling for Planneer with dark mode support
 */
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Elements, useYooptaEditor } from '@yoopta/editor';
import { cn } from '@/lib/design-system';

type Props = {
  blockId: string;
  onClose: () => void;
};

export const EmbedUploader = ({ blockId, onClose }: Props) => {
  const editor = useYooptaEditor();
  const [value, setValue] = useState('');

  const onChange = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value);

  const embed = () => {
    if (value.length === 0) return;

    Elements.updateElement(editor, {
      blockId,
      type: 'image',
      props: {
        src: value,
      },
    });

    onClose();
  };

  const isEmpty = value.length === 0;

  return (
    <div className="w-full space-y-3">
      <input
        type="text"
        placeholder="Paste image link..."
        value={value}
        onChange={onChange}
        className={cn(
          'w-full h-9 px-3 text-sm rounded-lg',
          'bg-[var(--color-surface-secondary)]',
          'text-[var(--color-text-primary)]',
          'border border-[var(--color-border-primary)]',
          'placeholder:text-[var(--color-text-tertiary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30'
        )}
      />
      <button
        type="button"
        disabled={isEmpty}
        onClick={embed}
        className={cn(
          'w-full h-9 rounded-lg text-sm font-medium',
          'bg-[var(--color-accent-primary)] text-white',
          'hover:bg-[var(--color-accent-emphasis)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
      >
        Embed image
      </button>
    </div>
  );
};
