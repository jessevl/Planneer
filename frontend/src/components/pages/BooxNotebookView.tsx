/**
 * @file BooxNotebookView.tsx
 * @description Dedicated read-only notebook viewer for mirrored BOOX PDFs
 * @app PAGES - Used when a mirrored BOOX notebook page is opened
 *
 * Features:
 * - Standalone PDF viewing without Yoopta editor overhead
 * - Shared viewer chrome reused from the PDF embed experience
 * - BOOX-specific sync metadata presentation
 *
 * Used by:
 * - PageDetailView
 */

import React, { useMemo, useState } from 'react';
import type { Page } from '@/types/page';
import { getPageFileUrl } from '@/api/pagesApi';
import PdfDocumentViewer, { type PdfDocumentViewMode } from '@/components/common/PdfDocumentViewer';
import { SmartEmptyState } from '@/components/ui';
import { CONTENT_WIDTH, getRightInsetStyle } from '@/lib/layout';

const BOOX_PAGE_ASPECT_RATIO = 210 / 297;

interface BooxNotebookViewProps {
  /** Mirrored BOOX page record. */
  page: Page;
  /** Optional floating panel inset reserved on the right. */
  contentRightInsetPx?: number;
}

const BooxNotebookView: React.FC<BooxNotebookViewProps> = ({
  page,
  contentRightInsetPx = 0,
}) => {
  const [viewMode, setViewMode] = useState<PdfDocumentViewMode>('inline');

  const pdfFilename = useMemo(() => {
    const files = page.files ?? [];
    return files.find((file) => file.toLowerCase().endsWith('.pdf')) ?? files[0] ?? null;
  }, [page.files]);

  const pdfUrl = pdfFilename ? getPageFileUrl(page.id, pdfFilename) : null;

  const syncedLabel = useMemo(() => {
    if (!page.sourceLastSyncedAt) return null;
    const parsed = new Date(page.sourceLastSyncedAt);
    if (Number.isNaN(parsed.getTime())) return page.sourceLastSyncedAt;
    return parsed.toLocaleString();
  }, [page.sourceLastSyncedAt]);

  const modifiedLabel = useMemo(() => {
    if (!page.sourceModifiedAt) return null;
    const parsed = new Date(page.sourceModifiedAt);
    if (Number.isNaN(parsed.getTime())) return page.sourceModifiedAt;
    return parsed.toLocaleString();
  }, [page.sourceModifiedAt]);

  const createdLabel = useMemo(() => {
    if (!page.sourceCreatedAt) return null;
    const parsed = new Date(page.sourceCreatedAt);
    if (Number.isNaN(parsed.getTime())) return page.sourceCreatedAt;
    return parsed.toLocaleString();
  }, [page.sourceCreatedAt]);

  const sizeLabel = useMemo(() => {
    const size = Number(page.sourceContentLength ?? 0);
    if (!Number.isFinite(size) || size <= 0) {
      return null;
    }

    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (size >= 1024) {
      return `${Math.round(size / 1024)} KB`;
    }
    return `${size} B`;
  }, [page.sourceContentLength]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative z-10 w-full" style={getRightInsetStyle(contentRightInsetPx)}>
          <div className={`mx-auto flex w-full ${CONTENT_WIDTH.default} flex-col gap-4 px-4 pb-8 pt-20 md:px-6 md:pb-10 md:pt-24`}>
          <div className="space-y-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              BOOX notebook mirror
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              Read-only notebook mirrored from WebDAV.
            </div>
            {page.sourcePath ? (
              <div className="text-xs text-[var(--color-text-tertiary)]">Source: {page.sourcePath}</div>
            ) : null}
            {createdLabel ? (
              <div className="text-xs text-[var(--color-text-tertiary)]">Created remotely: {createdLabel}</div>
            ) : null}
            {modifiedLabel ? (
              <div className="text-xs text-[var(--color-text-tertiary)]">Updated remotely: {modifiedLabel}</div>
            ) : null}
            {sizeLabel ? (
              <div className="text-xs text-[var(--color-text-tertiary)]">File size: {sizeLabel}</div>
            ) : null}
            {syncedLabel ? (
              <div className="text-xs text-[var(--color-text-tertiary)]">Last synced: {syncedLabel}</div>
            ) : null}
          </div>

          {pdfUrl ? (
            <PdfDocumentViewer
              url={pdfUrl}
              name={page.title || pdfFilename || 'BOOX Notebook'}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              inlineAspectRatio={BOOX_PAGE_ASPECT_RATIO}
            />
          ) : (
            <SmartEmptyState
              type="pages"
              title="Notebook file unavailable"
              description="This mirrored BOOX notebook does not have a PDF attached yet. Run BOOX sync again to refresh it."
            />
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BooxNotebookView;