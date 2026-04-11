/**
 * @file MediaPlaceholder.tsx
 * @description Unified placeholder component for media blocks (Image, PDF, Bookmark)
 * 
 * Shows a consistent button-style placeholder that opens a media modal when clicked.
 * This creates a unified UX across all media-related blocks in the editor.
 */
import { useCallback, useState } from 'react';
import { FileText, Image, Link, Plus } from 'lucide-react';
import { cn } from '@/lib/design-system';
import { MediaUploaderModal, MediaType, MediaUploaderResult } from './MediaUploaderModal';

interface MediaPlaceholderProps {
  /**
   * The type of media this placeholder is for
   */
  type: MediaType;
  /**
   * Called when media is selected (file uploaded or URL entered)
   */
  onMediaSelect: (result: MediaUploaderResult) => void;
  /**
   * Page ID for file uploads (required for upload functionality)
   */
  pageId?: string;
  /**
   * Whether the editor is in read-only mode
   */
  readOnly?: boolean;
  /**
   * Whether file upload is currently in progress
   */
  isUploading?: boolean;
  /**
   * Custom placeholder text
   */
  placeholder?: string;
  /**
   * Additional class names
   */
  className?: string;
}

const ICONS: Record<MediaType, typeof Image> = {
  image: Image,
  pdf: FileText,
  bookmark: Link,
};

const LABELS: Record<MediaType, string> = {
  image: 'Add an image',
  pdf: 'Add a PDF',
  bookmark: 'Add a link',
};

export function MediaPlaceholder({
  type,
  onMediaSelect,
  pageId,
  readOnly = false,
  isUploading = false,
  placeholder,
  className,
}: MediaPlaceholderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (!readOnly && !isUploading) {
      setIsModalOpen(true);
    }
  }, [readOnly, isUploading]);

  const handleMediaSelect = useCallback((result: MediaUploaderResult) => {
    onMediaSelect(result);
    setIsModalOpen(false);
  }, [onMediaSelect]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const Icon = ICONS[type];
  const label = placeholder || LABELS[type];

  if (readOnly) {
    return (
      <div
        className={cn(
          'yoopta-plugin-card flex items-center gap-2 p-3 rounded-lg',
          'border',
          'text-[var(--color-text-tertiary)]',
          className
        )}
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm">No {type} attached</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        className={cn(
          'yoopta-plugin-card yoopta-plugin-card--dashed w-full flex items-center gap-2 p-3 rounded-lg cursor-pointer',
          'border border-dashed',
          'transition-colors group',
          isUploading && 'opacity-50 cursor-not-allowed',
          className
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
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
          )}
        </div>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {isUploading ? 'Uploading...' : label}
        </span>
        {!isUploading && (
          <Plus className="w-4 h-4 text-[var(--color-text-tertiary)] ml-auto" />
        )}
      </button>

      <MediaUploaderModal
        isOpen={isModalOpen}
        onClose={handleClose}
        type={type}
        onSelect={handleMediaSelect}
        pageId={pageId}
      />
    </>
  );
}

export type { MediaType, MediaUploaderResult };
