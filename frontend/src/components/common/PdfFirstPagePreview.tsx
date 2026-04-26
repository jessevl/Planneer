/**
 * @file PdfFirstPagePreview.tsx
 * @description Thumbnail preview renderer for PDF-backed page cards
 * @app SHARED - Used by PDF preview cards
 *
 * Features:
 * - Shows backend-generated PNG thumbnails for PDF preview cards
 * - Avoids client-side PDF rendering in overview cards
 * - Provides a stable empty state when the backend preview is missing
 */

import React from 'react';
import { cn } from '@/lib/design-system';

interface PdfFirstPagePreviewProps {
  title: string;
  className?: string;
  /** Backend-generated thumbnail URL. */
  thumbnailUrl?: string | null;
  pageCount?: number | null;
}

const PdfFirstPagePreview: React.FC<PdfFirstPagePreviewProps> = ({
  title,
  className,
  thumbnailUrl,
  pageCount,
}) => {
  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={`Preview of ${title}`}
          className="h-full w-full object-cover object-top"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,239,230,0.86))] p-4 text-[var(--color-text-secondary)] dark:bg-[linear-gradient(180deg,rgba(22,22,22,0.95),rgba(34,34,34,0.9))]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            PNG preview unavailable
          </div>
          <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)]/70 p-3 text-sm">
            Refresh the page attachments to generate a fresh thumbnail.
          </div>
          {pageCount ? (
            <div className="text-xs text-[var(--color-text-tertiary)]">
              {pageCount} page{pageCount === 1 ? '' : 's'}
            </div>
          ) : <div />}
        </div>
      )}
    </div>
  );
};

export default PdfFirstPagePreview;