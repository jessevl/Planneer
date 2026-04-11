/**
 * @file MediaUploaderModal.tsx
 * @description Unified modal for adding media (Image, PDF, Bookmark)
 * Uses the standard Planneer Modal component for consistent UI.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Loader2,
} from 'lucide-react';
import { Modal } from '@/components/ui';
import { cn } from '@/lib/design-system';
import { uploadPageFile, uploadPageImage } from '@/api/pagesApi';
import { processImageForUpload } from '@/lib/imageUtils';

// ============================================================================
// TYPES
// ============================================================================

export type MediaType = 'image' | 'pdf' | 'bookmark';

export interface MediaUploaderResult {
  type: 'file' | 'url';
  url: string;
  filename?: string;
  size?: number;
  width?: number;
  height?: number;
}

interface MediaUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: MediaType;
  onSelect: (result: MediaUploaderResult) => void;
  pageId?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TYPE_CONFIG = {
  image: {
    icon: ImageIcon,
    title: 'Add Image',
    accept: 'image/jpeg,image/png,image/gif,image/webp',
    acceptText: 'JPG, PNG, GIF, WebP',
    urlPlaceholder: 'Paste image URL...',
    urlLabel: 'Embed image',
  },
  pdf: {
    icon: FileText,
    title: 'Add PDF',
    accept: 'application/pdf',
    acceptText: 'PDF files only',
    urlPlaceholder: 'Paste PDF URL...',
    urlLabel: 'Embed PDF',
  },
  bookmark: {
    icon: LinkIcon,
    title: 'Add Link',
    accept: '',
    acceptText: '',
    urlPlaceholder: 'Paste a link...',
    urlLabel: 'Create bookmark',
  },
} as const;

// ============================================================================
// MODAL COMPONENT
// ============================================================================

export function MediaUploaderModal({
  isOpen,
  onClose,
  type,
  onSelect,
  pageId,
}: MediaUploaderModalProps) {
  const config = TYPE_CONFIG[type];
  const showUploadTab = type !== 'bookmark';
  
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>(
    showUploadTab ? 'upload' : 'link'
  );
  const [inputUrl, setInputUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Focus URL input when switching to link tab or when modal opens for bookmark
  useEffect(() => {
    if (isOpen && activeTab === 'link') {
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputUrl('');
      setError(null);
      setActiveTab(showUploadTab ? 'upload' : 'link');
    }
  }, [isOpen, showUploadTab]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!pageId) {
      setError('Cannot upload: page not saved yet');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      if (type === 'image') {
        const processed = await processImageForUpload(file);
        const result = await uploadPageImage(
          pageId,
          processed.file,
          processed.width,
          processed.height
        );
        
        onSelect({
          type: 'file',
          url: result.src,
          width: result.sizes?.width,
          height: result.sizes?.height,
        });
      } else if (type === 'pdf') {
        const result = await uploadPageFile(pageId, file);
        
        onSelect({
          type: 'file',
          url: result.src,
          filename: result.originalName,
          size: result.size,
        });
      }
      
      onClose();
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [pageId, type, onSelect, onClose]);

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileUpload(file);
    }
  }, [handleFileUpload]);

  // Handle file input change
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
    e.target.value = '';
  }, [handleFileUpload]);

  // Handle URL submission
  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    let finalUrl = inputUrl.trim();
    if (!finalUrl) return;

    // Add https:// if no protocol specified
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    onSelect({
      type: 'url',
      url: finalUrl,
    });
    
    onClose();
  }, [inputUrl, onSelect, onClose]);

  const Icon = config.icon;
  const isUploadTab = activeTab === 'upload';
  const isLinkTab = activeTab === 'link';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.title}
      size="sm"
      zIndex={250}
    >
      {/* Tab Header (only show if upload is available) */}
      {showUploadTab && (
        <div
          className={cn(
            'flex w-full h-10 -mt-2 mb-4',
            'border-b border-[var(--color-border-default)]'
          )}
        >
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={cn(
              'px-3 h-full text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              isUploadTab
                ? 'text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]'
                : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
            )}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={cn(
              'px-3 h-full text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              isLinkTab
                ? 'text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]'
                : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
            )}
          >
            {type === 'pdf' ? 'PDF link' : 'Image link'}
          </button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tab Content */}
      <div>
        {isUploadTab && showUploadTab ? (
          // Upload tab content
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center p-8',
              'border-2 border-dashed rounded-lg cursor-pointer transition-colors',
              isDragOver
                ? 'border-[var(--color-interactive-border)] bg-[var(--color-interactive-bg)]'
                : 'border-[var(--color-border-default)] hover:border-[var(--color-border-subtle)]',
              isUploading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isUploading ? (
              <Loader2 className="w-10 h-10 text-[var(--color-accent-primary)] animate-spin mb-2" />
            ) : (
              <Icon className="w-10 h-10 text-[var(--color-text-tertiary)] mb-2" />
            )}
            <p className="text-sm text-[var(--color-text-secondary)]">
              {isUploading ? (
                'Uploading...'
              ) : (
                <>
                  Drop a file here or <span className="text-[var(--color-accent-primary)]">browse</span>
                </>
              )}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              {config.acceptText}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={config.accept}
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
          </div>
        ) : (
          // Link tab content
          <form onSubmit={handleUrlSubmit} className="space-y-3">
            <input
              ref={urlInputRef}
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder={config.urlPlaceholder}
              className={cn(
                'w-full px-3 py-2.5 text-sm rounded-lg',
                'bg-[var(--color-surface-secondary)]',
                'text-[var(--color-text-primary)]',
                'border border-[var(--color-border-primary)]',
                'placeholder:text-[var(--color-text-tertiary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30'
              )}
            />
            <button
              type="submit"
              disabled={!inputUrl.trim()}
              className={cn(
                'w-full px-4 py-2.5 text-sm font-medium rounded-lg',
                'bg-[var(--color-interactive-bg-strong)] text-white',
                'hover:brightness-110',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              {config.urlLabel}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
