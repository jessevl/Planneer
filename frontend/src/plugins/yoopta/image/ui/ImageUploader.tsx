/**
 * @file ImageUploader.tsx
 * @description Modal for uploading/embedding images
 * Uses standard Planneer Modal component for consistent UI
 */
import { useState } from 'react';
import { Modal } from '@/components/ui';
import { cn } from '@/lib/design-system';
import { EmbedUploader } from './EmbedUploader';
import { FileUploader } from './FileUploader';

type Props = {
  blockId: string;
  onClose: () => void;
  onSetLoading: (loading: boolean) => void;
};

type Tab = 'upload' | 'embed';

export const ImageUploader = ({ 
  onClose, 
  blockId, 
  onSetLoading 
}: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('upload');

  const isUploader = activeTab === 'upload';
  const isEmbed = activeTab === 'embed';

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Image"
      size="sm"
      zIndex={250}
    >
      {/* Tab Header */}
      <div
        className={cn(
          'flex w-full h-10 -mt-2 mb-4',
          'border-b border-[var(--color-border-secondary)]'
        )}
      >
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={cn(
            'px-3 h-full text-sm font-medium transition-colors',
            'border-b-2 -mb-px',
            isUploader
              ? 'text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]'
              : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
          )}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('embed')}
          className={cn(
            'px-3 h-full text-sm font-medium transition-colors',
            'border-b-2 -mb-px',
            isEmbed
              ? 'text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]'
              : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
          )}
        >
          Image link
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {isEmbed && <EmbedUploader onClose={onClose} blockId={blockId} />}
        {isUploader && (
          <FileUploader onClose={onClose} blockId={blockId} onSetLoading={onSetLoading} />
        )}
      </div>
    </Modal>
  );
};
