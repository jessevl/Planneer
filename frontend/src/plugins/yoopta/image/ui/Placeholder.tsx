/**
 * @file Placeholder.tsx
 * @description Empty state placeholder for image upload
 * Custom styling for Planneer with dark mode support
 * Matches the MediaPlaceholder styling from PDF/Bookmark plugins
 */
import { useState } from 'react';
import { cn } from '@/lib/design-system';
import { ImageIcon } from '@/components/common/Icons';
import { ImageUploader } from './ImageUploader';
import { Loader } from './Loader';

type Props = {
  attributes: Record<string, unknown>;
  children: React.ReactNode;
  blockId: string;
};

export const Placeholder = ({ attributes, children, blockId }: Props) => {
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);

  const onSetLoading = (state: boolean) => setLoading(state);

  return (
    <div
      className="w-full mt-0 mb-3 relative flex"
      {...attributes}
      contentEditable={false}
    >
      <button
        type="button"
        onClick={() => setIsUploaderOpen(true)}
        disabled={loading}
        className={cn(
          'yoopta-plugin-card yoopta-plugin-card--dashed w-full flex items-center gap-2 p-3 rounded-lg cursor-pointer',
          'border border-dashed',
          'transition-colors group',
          loading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            'bg-[var(--color-surface-tertiary)]',
            'group-hover:bg-[var(--color-surface-secondary)]',
            'transition-colors'
          )}
        >
          {loading ? (
            <Loader width={20} height={20} />
          ) : (
            <ImageIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
          )}
        </div>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {loading ? 'Uploading...' : 'Add an image'}
        </span>
      </button>
      {isUploaderOpen && (
        <ImageUploader
          blockId={blockId}
          onClose={() => setIsUploaderOpen(false)}
          onSetLoading={onSetLoading}
        />
      )}
      {children}
    </div>
  );
};
