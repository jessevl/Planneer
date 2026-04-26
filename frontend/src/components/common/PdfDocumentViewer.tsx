/**
 * @file PdfDocumentViewer.tsx
 * @description Shared PDF document viewer used by inline embeds and standalone PDF pages
 * @app SHARED - Used by PDF-backed pages and the Yoopta PDF plugin
 *
 * Features:
 * - Inline iframe PDF rendering
 * - Compact card mode for lightweight previews
 * - Shared viewer chrome with open-in-tab affordance
 *
 * Used by:
 * - PdfRender
 */

import React from 'react';
import { ExternalLink, FileText, Minimize2 } from 'lucide-react';

export type PdfDocumentViewMode = 'inline' | 'modal';

interface PdfDocumentViewerProps {
  /** Resolved PDF URL to render. */
  url: string;
  /** Display name shown in the viewer header. */
  name?: string;
  /** Optional file size in bytes. */
  size?: number;
  /** Rendering mode. */
  viewMode?: PdfDocumentViewMode;
  /** Inline iframe height in pixels. */
  inlineHeight?: number;
  /** Optional width/height ratio for the inline frame, e.g. A4 portrait is 210/297. */
  inlineAspectRatio?: number;
  /** Whether the viewer should suppress edit affordances. */
  readOnly?: boolean;
  /** Optional callback to toggle between inline and compact modes. */
  onViewModeChange?: (mode: PdfDocumentViewMode) => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  url,
  name,
  size,
  viewMode = 'inline',
  inlineHeight = 500,
  inlineAspectRatio,
  readOnly = false,
  onViewModeChange,
}) => {
  const canToggleView = !readOnly && Boolean(onViewModeChange);

  if (viewMode === 'modal') {
    return (
      <div
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        className="yoopta-plugin-card group flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
          <FileText className="h-5 w-5 text-red-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {name || 'PDF Document'}
          </div>
          {size ? (
            <div className="text-xs text-[var(--color-text-tertiary)]">{formatFileSize(size)}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canToggleView ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onViewModeChange?.('inline');
              }}
              className="rounded p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-tertiary)]"
              title="Switch to inline view"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          ) : null}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="rounded p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-tertiary)]"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="yoopta-plugin-card overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 flex-shrink-0 text-red-500" />
          <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {name || 'PDF Document'}
          </span>
          {size ? (
            <span className="flex-shrink-0 text-xs text-[var(--color-text-tertiary)]">
              ({formatFileSize(size)})
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {canToggleView ? (
            <button
              onClick={() => onViewModeChange?.('modal')}
              className="rounded p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-tertiary)]"
              title="Switch to compact view"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          ) : null}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-tertiary)]"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden bg-[var(--color-surface-secondary)]"
        style={inlineAspectRatio
          ? { aspectRatio: String(inlineAspectRatio) }
          : { height: inlineHeight }}
      >
        <iframe
          src={url}
          className="absolute inset-0 h-full w-full border-0 bg-[var(--color-surface-secondary)]"
          title={name || 'PDF Document'}
        />
      </div>
    </div>
  );
};

export default PdfDocumentViewer;